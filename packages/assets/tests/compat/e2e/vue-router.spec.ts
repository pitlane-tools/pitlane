// Behavior from hi-ogawa/vite-plugin-fullstack@28e9540 e2e/vue-router.test.ts,
// plus matched-route asset selection and the @pitlane/assets document
// contract (see helper.ts).
import { type Page, expect, test } from "@playwright/test";
import { type Fixture, useFixture } from "./fixture.ts";
import {
    collectErrors,
    expectDocumentAssets,
    expectNoReload,
    waitForHydration,
} from "./helper.ts";

test.describe("vue-router dev", () => {
    defineTest(useFixture({ example: "vue-router", mode: "dev" }));
});

test.describe("vue-router build", () => {
    defineTest(useFixture({ example: "vue-router", mode: "build" }));
});

// ssg:manifest — the example's own SSG plugin imports the built server after
// the build and writes HTML from the completed asset manifest.
test.describe("vue-router build ssg", () => {
    defineTest(
        useFixture({
            example: "vue-router",
            mode: "build",
            buildScript: "build-ssg",
            previewScript: "preview-ssg",
        }),
    );
});

function defineTest(f: Fixture) {
    test("basic", async ({ page }) => {
        await page.goto(f.url());
        await using _ = await expectNoReload(page);
        let errors = collectErrors(page);

        await waitForHydration(page, "#root");
        expect(errors).toEqual([]);

        await testClient(page);
        await testCss(page);
        await testNavigation(page);
        expect(errors).toEqual([]);
    });

    test("matched-route assets", async ({ page }) => {
        let home = await expectDocumentAssets(page, f, "/");
        let about = await expectDocumentAssets(page, f, "/about");

        if (f.mode === "build") {
            // preloads:matched-route — the index.vue chunk is hinted on "/" only
            let homeOnly = home.preloads.filter(h => !about.preloads.includes(h));
            let aboutOnly = about.preloads.filter(h => !home.preloads.includes(h));
            expect(homeOnly.length, "preloads:matched-route").toBeGreaterThan(0);
            expect(aboutOnly.length, "preloads:matched-route").toBeGreaterThan(0);
            // css:scoped-matched — index.vue's scoped style is linked on "/" only
            let homeCss = home.stylesheets.filter(h => !about.stylesheets.includes(h));
            expect(homeCss.length, "css:scoped-matched").toBeGreaterThan(0);
        } else {
            // dev: the scoped style of index.vue is observed through its SFC key
            expect(home.stylesheets.some(h => h.includes("index.vue")), "css:scoped-matched").toBe(true);
            expect(about.stylesheets.some(h => h.includes("index.vue")), "css:scoped-matched").toBe(false);
        }
    });

    test.describe(() => {
        test.use({ javaScriptEnabled: false });

        test("ssr", async ({ page }) => {
            await page.goto(f.url());
            await expect(page.locator(".counter-card")).toContainText("Count: 0");
            await testCss(page);
            if (f.mode === "build") {
                await expect(page.locator("link[rel='modulepreload']").first()).toBeAttached();
            }
        });
    });

    if (f.mode === "dev") {
        test("hmr vue", async ({ page }) => {
            await page.goto(f.url());
            await waitForHydration(page, "#root");
            await using _ = await expectNoReload(page);

            await testClient(page);

            let jsFile = f.createEditor("src/pages/index.vue");
            await jsFile.edit(s => s.replace("Count:", "Count-edit:"));
            await expect(page.locator(".counter-card")).toContainText("Count-edit: 1");

            let res = await page.request.get(page.url());
            expect(await res.text()).toContain("Count-edit:");

            await jsFile.reset();
            await expect(page.locator(".counter-card")).toContainText("Count: 1");
            await testCss(page);
        });

        // css:scoped-hmr — a scoped-style edit updates in place, without a
        // reload and without a stale duplicate overriding it
        test("hmr css", async ({ page }) => {
            await page.goto(f.url());
            await waitForHydration(page, "#root");
            await using _ = await expectNoReload(page);

            await testClient(page);

            let cssFile = f.createEditor("src/pages/index.vue");
            await cssFile.edit(s => s.replace("color: rgb(100, 108, 255);", "color: rgb(0, 0, 255);"));
            await expect(page.getByRole("heading", { name: "Vue Router Custom Framework" })).toHaveCSS(
                "color",
                "rgb(0, 0, 255)",
            );
            await cssFile.reset();
            await testCss(page);
        });
    }
}

async function testClient(page: Page) {
    await expect(page.locator(".counter-card")).toContainText("Count: 0");
    await page.getByRole("button", { name: "Increment" }).click();
    await expect(page.locator(".counter-card")).toContainText("Count: 1");
}

async function testCss(page: Page) {
    // styles.css
    await expect(page.getByRole("button", { name: "Increment" })).toHaveCSS("background-color", "rgb(83, 91, 242)");
    // index.vue (scoped css)
    await expect(page.getByRole("heading", { name: "Vue Router Custom Framework" })).toHaveCSS(
        "color",
        "rgb(100, 108, 255)",
    );
}

async function testNavigation(page: Page) {
    await page.getByRole("link", { name: "About" }).click();
    await page.waitForURL("**/about");
    await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
}
