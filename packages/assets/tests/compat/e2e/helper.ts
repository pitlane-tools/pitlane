// waitForHydration and expectNoReload adapted from
// hi-ogawa/vite-plugin-fullstack@28e9540 e2e/helper.ts (MIT).
import { type Page, expect } from "@playwright/test";
import type { Fixture } from "./fixture.ts";

export async function waitForHydration(page: Page, selector = "body") {
    await expect
        .poll(
            () =>
                page
                    .locator(selector)
                    .last()
                    .evaluate(el =>
                        Object.keys(el).some(
                            key =>
                                key.startsWith("__reactFiber") ||
                                key.startsWith("__island_ready__") ||
                                key.startsWith("__vue_app__"),
                        ),
                    ),
            { timeout: 5000 },
        )
        .toBeTruthy();
}

// Upstream marked the document with a <meta>; a window property is used here
// because Remix frame reloads may legitimately reconcile <head>, while only a
// real document reload discards window state.
export async function expectNoReload(page: Page) {
    await page.evaluate(() => Object.assign(window, { __compatNoReload: true }));
    return {
        [Symbol.asyncDispose]: async () => {
            expect(await page.evaluate(() => "__compatNoReload" in window), "no-reload").toBe(true);
            await page.evaluate(() => Reflect.deleteProperty(window, "__compatNoReload"));
        },
    };
}

export async function expectDocumentAssets(page: Page, f: Fixture, pathname = "/") {
    let response = await page.request.get(f.url(pathname));
    expect(response.ok()).toBe(true);
    let html = await response.text();

    let mapTags = [...html.matchAll(/<script[^>]*type="importmap"[^>]*>([\s\S]*?)<\/script>/g)];
    let mapsExpected = f.mode === "build" && f.chunkImportMap;
    if (mapsExpected) {
        expect(mapTags, "import-map:first").toHaveLength(1);
        let mapIndex = mapTags[0]!.index!;
        let firstModule = html.search(/<link[^>]*rel="modulepreload"|<script[^>]*type="module"/);
        expect(firstModule, "import-map:first").toBeGreaterThan(mapIndex);
    }

    let preloads = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map(m => m[1]!);
    preloads.push(...[...html.matchAll(/<link[^>]*href="([^"]+)"[^>]*rel="modulepreload"/g)].map(m => m[1]!));
    if (f.mode === "build") {
        expect(preloads.length, "preloads:present").toBeGreaterThan(0);
        for (let href of new Set(preloads)) {
            let served = await page.request.get(new URL(href, f.url(pathname)).href);
            expect(served.status(), `preloads:served ${href}`).toBe(200);
            expect(served.headers()["content-type"], `preloads:served ${href}`).toMatch(/javascript/);
        }
    }

    let stylesheets = [
        ...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g),
        ...html.matchAll(/<link[^>]*href="([^"]+)"[^>]*rel="stylesheet"/g),
    ].map(m => m[1]!);
    expect(stylesheets.length, "stylesheets:unique").toBe(new Set(stylesheets).size);

    return { html, preloads: [...new Set(preloads)], stylesheets };
}

/** Collects page errors; assert the returned array stays empty. */
export function collectErrors(page: Page): Error[] {
    let errors: Error[] = [];
    page.on("pageerror", error => errors.push(error));
    return errors;
}
