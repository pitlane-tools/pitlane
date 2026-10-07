// Behavior from hi-ogawa/vite-plugin-fullstack@28e9540 e2e/basic.test.ts,
// plus the @pitlane/assets document contract (see helper.ts).
import { type Page, expect, test } from "@playwright/test";
import { type Fixture, useFixture } from "./fixture.ts";
import {
    collectErrors,
    expectDocumentAssets,
    expectNoReload,
    waitForHydration,
} from "./helper.ts";

test.describe("basic dev", () => {
    defineTest(useFixture({ example: "basic", mode: "dev" }));
});

test.describe("basic build", () => {
    defineTest(useFixture({ example: "basic", mode: "build" }));
});

test.describe("cloudflare dev", () => {
    defineTest(useFixture({ example: "cloudflare", mode: "dev" }));
});

test.describe("cloudflare build", () => {
    defineTest(useFixture({ example: "cloudflare", mode: "build" }));
});

test.describe("basic build under a nested base", () => {
    let f = useFixture({
        example: "basic",
        mode: "build",
        buildScript: "build-base",
        previewScript: "preview-base",
    });

    // base:nested — every emitted URL the resolver returns carries the
    // deployment base, and the page still hydrates and styles itself.
    test("hydrates with every asset under /custom/base/", async ({ page }) => {
        let errors = collectErrors(page);
        let { preloads, stylesheets } = await expectDocumentAssets(page, f);
        for (let href of [...preloads, ...stylesheets]) {
            expect(href, "base:nested").toMatch(/^\/custom\/base\//);
        }
        await page.goto(f.url());
        await waitForHydration(page, "main");
        await page.getByRole("button", { name: "count is 0" }).click();
        await expect(page.getByRole("button", { name: "count is 1" })).toBeVisible();
        await expect(page.locator(".read-the-docs")).toHaveCSS("color", "rgb(136, 136, 136)");
        expect(errors).toEqual([]);
    });
});

function defineTest(f: Fixture) {
    test("basic", async ({ page }) => {
        await page.goto(f.url());
        await using _ = await expectNoReload(page);
        let errors = collectErrors(page);

        // hydration:react — no hydration mismatch
        await waitForHydration(page, "main");
        expect(errors).toEqual([]);

        await expect(page.getByRole("button", { name: "count is 0" })).toBeVisible();
        await page.getByRole("button", { name: "count is 0" }).click();
        await expect(page.getByRole("button", { name: "count is 1" })).toBeVisible();

        // css:server-imported — App.css, index.css, App.module.css
        await expect(page.locator(".read-the-docs")).toHaveCSS("color", "rgb(136, 136, 136)");
        await expect(page.locator("button")).toHaveCSS("background-color", "rgb(249, 249, 249)");
        await expect(page.getByTestId("css-module-test")).toHaveCSS("padding", "32px");

        expect(errors).toEqual([]);
    });

    test("document assets", async ({ page }) => {
        await expectDocumentAssets(page, f);
    });

    test.describe(() => {
        test.use({ javaScriptEnabled: false });

        test("ssr", async ({ page }) => {
            await page.goto(f.url());
            await expect(page.getByRole("button", { name: "count is 0" })).toBeVisible();
            await expect(page.locator(".read-the-docs")).toHaveCSS("color", "rgb(136, 136, 136)");
            await expect(page.getByTestId("css-module-test")).toHaveCSS("padding", "32px");
            if (f.mode === "build") {
                await expect(page.locator("link[rel='modulepreload']").first()).toBeAttached();
            }
        });
    });

    if (f.mode === "dev") {
        test("hmr react", async ({ page }) => {
            await page.goto(f.url());
            await waitForHydration(page, "main");
            await using _ = await expectNoReload(page);

            await page.getByRole("button", { name: "count is 0" }).click();
            await expect(page.getByRole("button", { name: "count is 1" })).toBeVisible();

            let jsFile = f.createEditor("src/App.tsx");
            await jsFile.edit(s => s.replace("count is", "count (edit) is"));
            await expect(page.getByRole("button", { name: "count (edit) is 1" })).toBeVisible();

            // SSR is also updated
            let res = await page.request.get(page.url());
            expect(await res.text()).toContain("count (edit)");

            await jsFile.reset();
            await expect(page.getByRole("button", { name: "count is 1" })).toBeVisible();
        });

        test("hmr css", async ({ page }) => {
            await page.goto(f.url());
            await waitForHydration(page, "main");
            await using _ = await expectNoReload(page);

            await page.getByRole("button", { name: "count is 0" }).click();
            await expect(page.getByRole("button", { name: "count is 1" })).toBeVisible();

            let cssFile = f.createEditor("src/App.css");
            await cssFile.edit(s => s.replace("color: rgb(136, 136, 136);", "color: rgb(36, 36, 36);"));
            await expect(page.locator(".read-the-docs")).toHaveCSS("color", "rgb(36, 36, 36)");
            await cssFile.reset();
            await expect(page.locator(".read-the-docs")).toHaveCSS("color", "rgb(136, 136, 136)");

            // css:no-duplicates — the server link and Vite's injected style coexist
            // without leaving a stale copy behind
            await expectNoStaleAppCss(page);
            await expect(page.getByRole("button", { name: "count is 1" })).toBeVisible();
        });

        test("hmr css module", async ({ page }) => {
            await page.goto(f.url());
            await waitForHydration(page, "main");
            await using _ = await expectNoReload(page);

            await page.getByRole("button", { name: "count is 0" }).click();
            await expect(page.getByRole("button", { name: "count is 1" })).toBeVisible();
            await expect(page.getByTestId("css-module-test")).toHaveCSS("padding", "32px");

            let cssModuleFile = f.createEditor("src/App.module.css");
            await cssModuleFile.edit(s => s.replace("padding: 2em;", "padding: 4em;"));
            await expect(page.getByTestId("css-module-test")).toHaveCSS("padding", "64px");
            await cssModuleFile.reset();
            await expect(page.getByTestId("css-module-test")).toHaveCSS("padding", "32px");
            await expect(page.getByRole("button", { name: "count is 1" })).toBeVisible();
        });

        // css:import-change — adding and removing a stylesheet import in a
        // server-rendered module refreshes the next document's stylesheet list.
        test("css import added and removed", async ({ page }) => {
            let added = f.createFile("src/added.css", ".read-the-docs { outline: 3px solid rgb(1, 2, 3); }\n");
            let app = f.createEditor("src/App.tsx");
            await app.edit(s => `import "./added.css";\n${s}`);
            await expect
                .poll(async () => (await expectDocumentAssets(page, f)).stylesheets.some(h => h.includes("added.css")))
                .toBe(true);
            await page.goto(f.url());
            await expect(page.locator(".read-the-docs")).toHaveCSS("outline-color", "rgb(1, 2, 3)");

            await app.reset();
            await expect
                .poll(async () => (await expectDocumentAssets(page, f)).stylesheets.some(h => h.includes("added.css")))
                .toBe(false);
            added.remove();
        });
    }
}

async function expectNoStaleAppCss(page: Page) {
    let copies = await page.evaluate(() => {
        let rules = 0;
        for (let sheet of Array.from(document.styleSheets)) {
            try {
                for (let rule of Array.from(sheet.cssRules)) {
                    if (rule.cssText.startsWith(".read-the-docs")) rules++;
                }
            } catch {}
        }
        return rules;
    });
    // At most the server link and Vite's injected style, both current.
    expect(copies, "css:no-duplicates").toBeLessThanOrEqual(2);
    await expect(page.locator(".read-the-docs")).toHaveCSS("color", "rgb(136, 136, 136)");
}
