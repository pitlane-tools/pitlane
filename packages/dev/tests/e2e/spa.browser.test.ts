/// <reference lib="dom" />
import type { Browser, Page } from "playwright";

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { startDevServer, type DevServer } from "./harness.ts";

declare global {
    interface Window {
        // Sentinel set after each navigation. A state-preserving HMR update keeps
        // it; a full page reload wipes it — the difference the tests assert on.
        __hmrAlive?: string;
    }
}

const FIXTURE = join(import.meta.dirname, "../fixtures/spa-app");
const APP = join(FIXTURE, "app");

// Files the scenarios rewrite; restored to their committed baseline after each
// test so the fixture never drifts and the tests stay order-independent.
const MUTABLE = ["fn-counter.tsx", "arrow-counter.tsx"];

// The browser suite runs wherever Playwright's Chromium is installed (CI runs
// `playwright install chromium`; locally, run it once). Skip cleanly otherwise
// so `vp test` stays green on machines without a browser.
let browserInstalled = existsSync(chromium.executablePath());

// The same scenarios run against both dev pipelines. Bundled dev mode serves a
// rolldown bundle instead of unbundled ESM modules, which rewrites every module
// URL the HMR transforms bake in — the reason it is worth asserting separately.
const PIPELINES = [
    // Unbundled dev serves the source module at its own URL…
    { name: "unbundled dev", bundled: false, entry: "/app/entry.browser.tsx" },
    // …while bundled dev serves a rolldown chunk instead.
    { name: "bundled dev", bundled: true, entry: "/assets/index.js" },
];

describe.skipIf(!browserInstalled).each(PIPELINES)("SPA mode in $name", ({ bundled, entry }) => {
    let server: DevServer;
    let browser: Browser;
    let page: Page;
    let baselines = new Map<string, string>();

    beforeAll(async () => {
        for (let file of MUTABLE) {
            baselines.set(file, await readFile(join(APP, file), "utf8"));
        }

        server = await startDevServer(FIXTURE, { bundled });
        browser = await chromium.launch({ headless: true });
    }, 90_000);

    afterEach(async () => {
        await page?.close();
        await restoreFixture();
    });

    afterAll(async () => {
        await browser?.close();
        server?.close();
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
        await page.goto(server.url, { waitUntil: "networkidle" });
        await page.waitForSelector("[data-fn-counter]");
        await page.evaluate(() => (window.__hmrAlive = "component"));
        return page;
    }

    it("renders the app client-side with no server markup", async () => {
        await openApp();

        // Nothing server-rendered: the document ships an empty container and
        // the runtime fills it, so there are no hydration markers to import.
        let html = await page.content();
        expect(html).not.toContain("rmx-data");

        // …and the document loads its script from the pipeline under test, so a
        // harness that silently ignored --bundled would fail here.
        let sources = await page.$$eval("script[src]", nodes =>
            nodes.map(node => new URL((node as HTMLScriptElement).src).pathname),
        );
        expect(sources).toContain(entry);

        await page.click("[data-fn-counter]");
        await page.click("[data-fn-counter]");
        await page.click("[data-fn-counter]");
        expect(await page.textContent("[data-fn-count]")).toBe("3");

        await page.click("[data-arrow-counter]");
        await page.click("[data-arrow-counter]");
        expect(await page.textContent("[data-arrow-count]")).toBe("2");
    });

    it("hot-swaps a function-form component while preserving its state", async () => {
        await openApp();

        await page.click("[data-fn-counter]");
        await page.click("[data-fn-counter]");
        await page.click("[data-fn-counter]");
        expect(await page.textContent("[data-fn-count]")).toBe("3");

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

    it("hot-swaps an arrow-form component while preserving its state", async () => {
        await openApp();

        await page.click("[data-arrow-counter]");
        await page.click("[data-arrow-counter]");
        expect(await page.textContent("[data-arrow-count]")).toBe("2");

        await edit("arrow-counter.tsx", "Arrow label A:", "Arrow label B:");

        await page.waitForFunction(
            () =>
                document
                    .querySelector("[data-arrow-counter]")
                    ?.textContent?.includes("Arrow label B"),
            undefined,
            { timeout: 10_000 },
        );

        expect(await page.textContent("[data-arrow-count]")).toBe("2");
        expect(await page.evaluate(() => window.__hmrAlive)).toBe("component");
    });
});
