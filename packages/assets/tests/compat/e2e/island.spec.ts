// Behavior from hi-ogawa/vite-plugin-fullstack@28e9540 e2e/island.test.ts
// (Preact half), plus the @pitlane/assets document contract (see helper.ts).
import { type Page, expect, test } from "@playwright/test";
import { type Fixture, useFixture } from "./fixture.ts";
import {
    collectErrors,
    expectDocumentAssets,
    expectNoReload,
    waitForHydration,
} from "./helper.ts";

test.describe("island dev", () => {
    defineTest(useFixture({ example: "island", mode: "dev" }));
});

test.describe("island build", () => {
    defineTest(useFixture({ example: "island", mode: "build" }));
});

function defineTest(f: Fixture) {
    test("basic", async ({ page }) => {
        await page.goto(f.url());
        let errors = collectErrors(page);

        // hydration:custom-island — the example's own <demo-island> runtime
        await waitForHydration(page, "demo-island");
        expect(errors).toEqual([]);

        await testClient(page);
        await testCss(page);
        await testNavigation(page);
        expect(errors).toEqual([]);
    });

    test("island entry and preloads", async ({ page }) => {
        let { html } = await expectDocumentAssets(page, f);
        let entry = html.match(/<demo-island[^>]*entry="([^"]+)"/)?.[1];
        expect(entry, "island:entry").toBeTruthy();
        if (f.mode === "dev") {
            expect(entry, "island:entry").toBe("/src/islands/counter.tsx");
        } else {
            expect(entry, "island:entry").toMatch(/^\/assets\/.+\.js$/);
            // island:preload — the island chunk itself is hinted
            expect(html, "island:preload").toContain(`rel="modulepreload" href="${entry}"`);
            let served = await page.request.get(f.url(entry!));
            expect(served.status()).toBe(200);
        }
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
    });

    if (f.mode === "dev") {
        test("component hmr", async ({ page }) => {
            await page.goto(f.url());
            await waitForHydration(page, "demo-island");
            await using _ = await expectNoReload(page);

            await testClient(page);

            let jsFile = f.createEditor("src/islands/counter.tsx");
            await jsFile.edit(s => s.replace("Count:", "Count-edit:"));
            await expect(page.locator(".counter-card")).toContainText("Count-edit: 3");

            // SSR is also updated
            let res = await page.request.get(page.url());
            expect(await res.text()).toContain("Count-edit:");

            await jsFile.reset();
            await expect(page.locator(".counter-card")).toContainText("Count: 3");
            await testCss(page);
        });

        test("hmr css", async ({ page }) => {
            await page.goto(f.url());
            await waitForHydration(page, "demo-island");
            await using _ = await expectNoReload(page);

            await testClient(page);

            let cssFile = f.createEditor("src/routes/index.css");
            await cssFile.edit(s => s.replace("color: rgb(100, 108, 255);", "color: rgb(0, 0, 255);"));
            await expect(page.getByRole("heading", { name: "Island Framework" })).toHaveCSS(
                "color",
                "rgb(0, 0, 255)",
            );
            await cssFile.reset();
            await testCss(page);
        });
    }
}

async function testClient(page: Page) {
    await expect(page.locator(".counter-card")).toContainText("Count: 2");
    await page.getByRole("button", { name: "Increment" }).click();
    await expect(page.locator(".counter-card")).toContainText("Count: 3");
}

async function testCss(page: Page) {
    // root.css
    await expect(page.getByRole("button", { name: "Increment" })).toHaveCSS("background-color", "rgb(83, 91, 242)");
    // routes/index.css
    await expect(page.getByRole("heading", { name: "Island Framework" })).toHaveCSS("color", "rgb(100, 108, 255)");
}

async function testNavigation(page: Page) {
    await page.getByRole("link", { name: "About" }).click();
    await page.waitForURL("**/about");
    await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
}
