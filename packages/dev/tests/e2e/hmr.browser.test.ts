/// <reference lib="dom" />
import type { ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import type { Browser, Page } from "playwright";

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

declare global {
    interface Window {
        // Sentinel set after each navigation. A state-preserving HMR update keeps
        // it; a full page reload wipes it — the difference the tests assert on.
        __hmrAlive?: string;
        // Navigation types the app observed. The injected fallback revalidates by
        // navigating, so it shows up here; a direct frame reload does not.
        __navigations?: string[];
    }
}

const HARNESS = join(import.meta.dirname, "harness/dev-server.mjs");
const FIXTURE = join(import.meta.dirname, "../fixtures/hmr-app");
const APP = join(FIXTURE, "app");

// Files the scenarios rewrite; restored to their committed baseline after each
// test so the fixture never drifts and the tests stay order-independent.
const MUTABLE = ["fn-counter.tsx", "arrow-counter.tsx", "document.tsx"];

// The browser suite runs wherever Playwright's Chromium is installed (CI runs
// `playwright install chromium`; locally, run it once). Skip cleanly otherwise
// so `vp test` stays green on machines without a browser.
let browserInstalled = existsSync(chromium.executablePath());

function waitForReady(child: ChildProcessByStdio<null, Readable, Readable>): Promise<string> {
    let { promise, resolve, reject } = Promise.withResolvers<string>();
    let output = "";
    // Integration timeout: a real dev server may hang on boot, and a bounded
    // failure with the captured log beats a bare test-runner timeout.
    let timeout = AbortSignal.timeout(60_000);
    timeout.addEventListener("abort", () =>
        reject(new Error(`dev server never became ready:\n${output}`)),
    );
    child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        let match = output.match(/pitlane-hmr-harness ready (\S+)/);
        if (match) resolve(match[1]);
    });
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("exit", code => reject(new Error(`dev server exited early (${code}):\n${output}`)));
    return promise;
}

describe.skipIf(!browserInstalled)("HMR in the browser", () => {
    let server: ChildProcessByStdio<null, Readable, Readable>;
    let browser: Browser;
    let baseUrl: string;
    let page: Page;
    let baselines = new Map<string, string>();

    beforeAll(async () => {
        for (let file of MUTABLE) {
            baselines.set(file, await readFile(join(APP, file), "utf8"));
        }

        server = spawn(process.execPath, [HARNESS, FIXTURE, "0"], {
            stdio: ["ignore", "pipe", "pipe"],
        });
        baseUrl = await waitForReady(server);

        browser = await chromium.launch({ headless: true });
    }, 90_000);

    afterEach(async () => {
        await page?.close();
        await restoreFixture();
    });

    afterAll(async () => {
        await browser?.close();
        server?.kill("SIGTERM");
        await restoreFixture();
    });

    async function restoreFixture(): Promise<void> {
        for (let [file, contents] of baselines) {
            await writeFile(join(APP, file), contents);
        }
    }

    async function edit(file: string, from: string, to: string): Promise<void> {
        let path = join(APP, file);
        let contents = await readFile(path, "utf8");
        if (!contents.includes(from)) {
            throw new Error(`edit target ${JSON.stringify(from)} not found in ${file}`);
        }
        await writeFile(path, contents.replace(from, to));
    }

    async function openApp(path = ""): Promise<Page> {
        page = await browser.newPage();
        await page.goto(baseUrl.replace(/\/$/, "") + "/" + path, { waitUntil: "networkidle" });
        await page.waitForSelector("[data-fn-counter]");
        return page;
    }

    it("hydrates and drives both islands", async () => {
        await openApp();

        await page.click("[data-fn-counter]");
        await page.click("[data-fn-counter]");
        await page.click("[data-fn-counter]");
        expect(await page.textContent("[data-fn-count]")).toBe("3");

        await page.click("[data-arrow-counter]");
        await page.click("[data-arrow-counter]");
        expect(await page.textContent("[data-arrow-count]")).toBe("2");
    });

    it("hot-swaps a function-form island while preserving its state", async () => {
        await openApp();

        await page.click("[data-fn-counter]");
        await page.click("[data-fn-counter]");
        await page.click("[data-fn-counter]");
        expect(await page.textContent("[data-fn-count]")).toBe("3");

        await page.evaluate(() => (window.__hmrAlive = "component"));
        await edit("fn-counter.tsx", "Fn label A:", "Fn label B:");

        await page.waitForFunction(
            () => document.querySelector("[data-fn-counter]")?.textContent?.includes("Fn label B"),
            undefined,
            { timeout: 10_000 },
        );

        // The edit swapped the render output without remounting: the click count
        // survives, and the page never fully reloaded (the sentinel is intact).
        expect(await page.textContent("[data-fn-count]")).toBe("3");
        expect(await page.evaluate(() => window.__hmrAlive)).toBe("component");
    });

    it("revalidates server-rendered content while preserving island state", async () => {
        await openApp();

        await page.click("[data-fn-counter]");
        await page.click("[data-fn-counter]");
        expect(await page.textContent("[data-fn-count]")).toBe("2");

        await page.evaluate(() => (window.__hmrAlive = "server-data"));
        await edit("document.tsx", "Server heading A", "Server heading B");

        await page.waitForFunction(
            () => document.querySelector("[data-h1]")?.textContent === "Server heading B",
            undefined,
            { timeout: 10_000 },
        );

        // A server-only edit re-fetched the page and reconciled it in place:
        // the hydrated island keeps its state and there was no full reload.
        expect(await page.textContent("[data-fn-count]")).toBe("2");
        expect(await page.evaluate(() => window.__hmrAlive)).toBe("server-data");
    });

    it("revalidates through a frame handle without navigating", async () => {
        await openApp("claimed");
        await page.waitForSelector("[data-frame-counter]");

        await page.click("[data-frame-counter]");
        await page.click("[data-frame-counter]");
        await page.click("[data-fn-counter]");

        await page.evaluate(() => {
            window.__hmrAlive = "frame-handle";
            window.__navigations!.length = 0;
        });
        await edit("document.tsx", "Server heading A", "Server heading B");

        await page.waitForFunction(
            () => document.querySelector("[data-h1]")?.textContent === "Server heading B",
            undefined,
            { timeout: 10_000 },
        );

        // `acceptServerUpdates` reloaded the top frame directly: every island
        // keeps its state, the page never reloaded, and no navigation happened —
        // which is also how we know the injected fallback stood down.
        expect(await page.textContent("[data-frame-count]")).toBe("2");
        expect(await page.textContent("[data-fn-count]")).toBe("1");
        expect(await page.evaluate(() => window.__hmrAlive)).toBe("frame-handle");
        expect(await page.evaluate(() => window.__navigations)).toEqual([]);
    });

    it("hot-swaps arrow-form islands while preserving their state", async () => {
        await openApp();

        await page.click("[data-arrow-counter]");
        await page.click("[data-arrow-counter]");
        expect(await page.textContent("[data-arrow-count]")).toBe("2");

        await page.evaluate(() => (window.__hmrAlive = "arrow"));
        await edit("arrow-counter.tsx", "Arrow label A:", "Arrow label B:");

        await page.waitForFunction(
            () =>
                document
                    .querySelector("[data-arrow-counter]")
                    ?.textContent?.includes("Arrow label B"),
            undefined,
            { timeout: 10_000 },
        );

        // The plugin normalizes the arrow-form island to a named function, so it
        // is now a hot-swap boundary too: the click count survives the edit and
        // the page never fully reloaded.
        expect(await page.textContent("[data-arrow-count]")).toBe("2");
        expect(await page.evaluate(() => window.__hmrAlive)).toBe("arrow");
    });
});
