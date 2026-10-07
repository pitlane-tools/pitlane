// The upstream remix example's behavior (e2e/island.test.ts, Remix half)
// re-expressed against released remix@3.0.0 through @pitlane/vite-plugin-remix:
// clientEntry() islands, render({ assets }), frames, and server-update HMR.
import { type Page, expect, test } from "@playwright/test";
import { type Fixture, useFixture } from "./fixture.ts";
import { collectErrors, expectDocumentAssets, expectNoReload } from "./helper.ts";

test.describe("remix dev", () => {
    defineTest(useFixture({ example: "remix", mode: "dev" }));
});

test.describe("remix build", () => {
    defineTest(useFixture({ example: "remix", mode: "build" }));
});

function defineTest(f: Fixture) {
    test("basic", async ({ page }) => {
        let errors = collectErrors(page);
        await page.goto(f.url());

        await testClient(page);
        await testCss(page);

        // navigation:frame — link navigation re-renders the top frame without
        // a document reload
        let noReload = await expectNoReload(page);
        await page.getByRole("link", { name: "About" }).click();
        await page.waitForURL("**/about");
        await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
        await page.getByRole("link", { name: "Home" }).click();
        await page.waitForURL(f.url("/"));
        await noReload[Symbol.asyncDispose]();
        // hydration:after-navigation — the island hydrates again after returning
        await expect(page.locator(".counter-card")).toContainText("Count: 2");
        await page.getByRole("button", { name: "Increment" }).click();
        await expect(page.locator(".counter-card")).toContainText("Count: 3");
        expect(errors).toEqual([]);
    });

    test("document assets and island hydration record", async ({ page }) => {
        let { html, preloads } = await expectDocumentAssets(page, f);
        let data = JSON.parse(html.match(/<script[^>]*id="rmx-data"[^>]*>([\s\S]*?)<\/script>/)![1]!) as {
            h: Record<string, { moduleUrl: string; exportName: string; props: unknown }>;
        };
        let record = Object.values(data.h).find(entry => entry.exportName === "Counter");
        // island:record — moduleUrl is the dev URL or the emitted chunk URL,
        // never a file: id or import-map identifier
        expect(record, "island:record").toBeTruthy();
        if (f.mode === "dev") {
            expect(record!.moduleUrl, "island:record").toBe("/app/counter.tsx");
        } else {
            expect(record!.moduleUrl, "island:record").toMatch(/^\/assets\/counter-[^/]+\.js$/);
            // island:preload — render({ assets }) hoists the island's preloads
            expect(preloads, "island:preload").toContain(record!.moduleUrl);
            expect(html, "island:preload").toMatch(/data-rmx-module-preload/);
        }
        expect(record!.props).toEqual({ initialCount: 2 });
    });

    test.describe(() => {
        test.use({ javaScriptEnabled: false });

        test("ssr", async ({ page }) => {
            await page.goto(f.url());
            await expect(page.locator(".counter-card")).toContainText("Count: 2");
            await testCss(page);
            if (f.mode === "build") {
                await expect(page.locator("link[rel='modulepreload']").first()).toBeAttached();
            }
        });

        test("frame nojs", async ({ page }) => {
            await page.goto(f.url("/books"));
            await testFrame(page);
        });
    });

    test("frame", async ({ page }) => {
        await page.goto(f.url("/books"));
        // Cart islands have loaded their modules before the first submit,
        // so it is handled in place instead of as a native form post.
        await page.waitForLoadState("networkidle");
        await using _ = await expectNoReload(page);
        await testFrame(page);
    });

    test("not found", async ({ page }) => {
        let response = await page.goto(f.url("/missing"));
        expect(response?.status()).toBe(404);
        await expect(page.getByRole("heading", { name: "Not Found 404" })).toBeVisible();
    });

    if (f.mode === "dev") {
        test("hmr css", async ({ page }) => {
            await page.goto(f.url());
            await testClient(page);
            await using _ = await expectNoReload(page);

            let cssFile = f.createEditor("app/pages/index.css");
            await cssFile.edit(s => s.replace("color: rgb(100, 108, 255);", "color: rgb(0, 0, 255);"));
            await expect(page.getByRole("heading", { name: "Island Framework" })).toHaveCSS(
                "color",
                "rgb(0, 0, 255)",
            );
            await cssFile.reset();
            await testCss(page);
            // state:preserved — the island kept its count through the CSS update
            await expect(page.locator(".counter-card")).toContainText("Count: 3");
        });

        test("hmr server", async ({ page }) => {
            await page.goto(f.url());
            await testClient(page);
            await using _ = await expectNoReload(page);

            let file = f.createEditor("app/pages/home.tsx");
            await file.edit(s => s.replace("Island Framework", "Island-edit-Framework"));
            await expect(page.locator(".hero")).toContainText("Island-edit-Framework");
            await file.reset();
            await expect(page.locator(".hero")).toContainText("Island Framework");
            // state:preserved — server:update revalidates without resetting the island
            await expect(page.locator(".counter-card")).toContainText("Count: 3");
        });
    }
}

async function testClient(page: Page) {
    await expect(page.locator(".counter-card")).toContainText("Count: 2");
    // hydration:island — clicking only increments once the island hydrated
    await expect
        .poll(async () => {
            await page.getByRole("button", { name: "Increment" }).click();
            return page.locator(".counter-card").textContent();
        })
        .toContain("Count: 3");
}

async function testCss(page: Page) {
    // root.css, linked through assets.getHref()
    await expect(page.getByRole("button", { name: "Increment" })).toHaveCSS("background-color", "rgb(83, 91, 242)");
    // pages/index.css, observed through assets.getStylesheets()
    await expect(page.getByRole("heading", { name: "Island Framework" })).toHaveCSS("color", "rgb(100, 108, 255)");
}

async function testFrame(page: Page) {
    await expect(page.locator(".book-card").nth(0)).toContainText("The Great Gatsby");
    await expect(page.locator(".book-card").nth(1)).toContainText("To Kill a Mockingbird");

    await expect(page.locator(".book-card button").nth(0)).toContainText("Add to Cart");
    await page.locator(".book-card button").nth(0).click();
    await expect(page.locator(".book-card button").nth(0)).toContainText("Remove from Cart");
    await page.locator(".book-card button").nth(0).click();
    await expect(page.locator(".book-card button").nth(0)).toContainText("Add to Cart");
}
