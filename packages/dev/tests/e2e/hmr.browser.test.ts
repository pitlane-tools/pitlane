/// <reference lib="dom" />
import type { Browser, Page } from "playwright";

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { startDevServer, type DevServer } from "./harness.ts";

declare global {
    interface Window {
        // Sentinel set after each navigation. A state-preserving HMR update keeps
        // it; a full page reload wipes it — the difference the tests assert on.
        __hmrAlive?: string;
        // Navigation types the app observed. Revalidating by navigating would show
        // up here; a direct frame reload does not.
        __navigations?: string[];
    }
}

const FIXTURE = join(import.meta.dirname, "../fixtures/hmr-app");
const APP = join(FIXTURE, "app");

// Files the scenarios rewrite; restored to their committed baseline after each
// test so the fixture never drifts and the tests stay order-independent.
const MUTABLE = ["fn-counter.tsx", "arrow-counter.tsx", "document.tsx"];

// The browser suite runs wherever Playwright's Chromium is installed (CI runs
// `playwright install chromium`; locally, run it once). Skip cleanly otherwise
// so `vp test` stays green on machines without a browser.
let browserInstalled = existsSync(chromium.executablePath());

describe.skipIf(!browserInstalled)("HMR in the browser", () => {
    let server: DevServer;
    let browser: Browser;
    let baseUrl: string;
    let page: Page;
    let baselines = new Map<string, string>();

    beforeAll(async () => {
        for (let file of MUTABLE) {
            baselines.set(file, await readFile(join(APP, file), "utf8"));
        }

        browser = await chromium.launch({ headless: true });
    }, 90_000);

    beforeEach(async () => {
        server = await startDevServer(FIXTURE);
        baseUrl = server.url;
    }, 90_000);

    afterEach(async () => {
        await page?.close();
        server?.close();
        await restoreFixture();
    });

    afterAll(async () => {
        await browser?.close();
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

    async function openApp(): Promise<Page> {
        page = await browser.newPage();
        await page.goto(baseUrl, { waitUntil: "networkidle" });
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

    it("revalidates server-rendered content without navigating", async () => {
        await openApp();

        await page.click("[data-fn-counter]");
        await page.click("[data-fn-counter]");
        await page.click("[data-arrow-counter]");

        await page.evaluate(() => {
            window.__hmrAlive = "server-data";
            window.__navigations!.length = 0;
        });
        await edit("document.tsx", "Server heading A", "Server heading B");

        await page.waitForFunction(
            () => document.querySelector("[data-h1]")?.textContent === "Server heading B",
            undefined,
            { timeout: 10_000 },
        );

        // The browser entry reloaded the top frame: the page refetched through the app's
        // fetch handler, every island kept its state, and nothing navigated,
        // which is what distinguishes a frame reload from the alternatives.
        expect(await page.textContent("[data-fn-count]")).toBe("2");
        expect(await page.textContent("[data-arrow-count]")).toBe("1");
        expect(await page.evaluate(() => window.__hmrAlive)).toBe("server-data");
        expect(await page.evaluate(() => window.__navigations)).toEqual([]);
    });

    it("collapses server updates that arrive mid-revalidation into one follow-up", async () => {
        // Count the server-update events the dev server pushes over Vite's HMR
        // socket, so each edit below lands as its own event rather than being
        // folded into the server-side settle window.
        page = await browser.newPage();
        let serverUpdates = 0;
        page.on("websocket", socket => {
            socket.on("framereceived", ({ payload }) => {
                if (String(payload).includes("pitlane:server-update")) serverUpdates++;
            });
        });
        await page.goto(baseUrl, { waitUntil: "networkidle" });
        await page.waitForSelector("[data-fn-counter]");

        await page.click("[data-fn-counter]");
        await page.click("[data-fn-counter]");
        await page.evaluate(() => {
            window.__hmrAlive = "coalesce";
            window.__navigations!.length = 0;
        });

        // Hold the first page refetch open so later updates arrive while it is
        // still in flight.
        let reloads = 0;
        let held = Promise.withResolvers<void>();
        let release = Promise.withResolvers<void>();
        await page.route(
            url => url.pathname === "/",
            async route => {
                reloads++;
                if (reloads === 1) {
                    held.resolve();
                    await release.promise;
                }
                await route.continue();
            },
        );

        await edit("document.tsx", "Server heading A", "Server heading B");
        await held.promise;

        await edit("document.tsx", "Server heading B", "Server heading C");
        await expect.poll(() => serverUpdates, { timeout: 10_000 }).toBe(2);
        await edit("document.tsx", "Server heading C", "Server heading D");
        await expect.poll(() => serverUpdates, { timeout: 10_000 }).toBe(3);

        // Two updates arrived during the held refetch and neither started one.
        expect(reloads).toBe(1);

        release.resolve();
        await page.waitForFunction(
            () => document.querySelector("[data-h1]")?.textContent === "Server heading D",
            undefined,
            { timeout: 10_000 },
        );
        await expect.poll(() => reloads, { timeout: 10_000 }).toBe(2);

        // The queued updates collapsed into exactly one follow-up refetch, and
        // nothing else stacked up behind it. Proving an absence needs a quiet
        // window on the real clock: the refetches run in the browser against a
        // live dev server, out of reach of fake timers.
        await new Promise(resolve => setTimeout(resolve, 500));
        expect(reloads).toBe(2);
        expect(await page.textContent("[data-h1]")).toBe("Server heading D");
        expect(await page.textContent("[data-fn-count]")).toBe("2");
        expect(await page.evaluate(() => window.__hmrAlive)).toBe("coalesce");
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
