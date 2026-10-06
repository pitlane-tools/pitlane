// Behavior from hi-ogawa/vite-plugin-fullstack@28e9540 e2e/react-router.test.ts,
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

test.describe("react-router dev", () => {
    defineTest(useFixture({ example: "react-router", mode: "dev" }));
});

test.describe("react-router build", () => {
    defineTest(useFixture({ example: "react-router", mode: "build" }));
});

function defineTest(f: Fixture) {
    test("basic", async ({ page }) => {
        await page.goto(f.url());
        await using _ = await expectNoReload(page);
        let errors = collectErrors(page);

        await waitForHydration(page);
        expect(errors).toEqual([]);

        await testClient(page);
        await testCss(page);
        // navigation:client — router navigation keeps the document
        await testNavigation(page);
        expect(errors).toEqual([]);
    });

    test("matched-route assets", async ({ page }) => {
        let home = await expectDocumentAssets(page, f, "/");
        let about = await expectDocumentAssets(page, f, "/about");
        let post = await expectDocumentAssets(page, f, "/blog/hello-world");

        // css:matched-route — page.css belongs to "/" only
        expect(home.stylesheets.some(h => h.includes("page")), "css:matched-route").toBe(true);
        expect(about.stylesheets.some(h => /\/routes\/page\.css|page-.*\.css/.test(h)), "css:matched-route").toBe(
            false,
        );

        if (f.mode === "build") {
            // preloads:matched-route — each page hints its own route chunk and
            // never an unrelated route's chunk
            let aboutOnly = about.preloads.filter(h => !home.preloads.includes(h));
            let postOnly = post.preloads.filter(h => !home.preloads.includes(h));
            expect(aboutOnly.length, "preloads:matched-route").toBeGreaterThan(0);
            expect(postOnly.length, "preloads:matched-route").toBeGreaterThan(0);
            for (let href of [...aboutOnly, ...postOnly]) {
                expect(home.preloads, "preloads:unrelated-absent").not.toContain(href);
            }
            for (let href of aboutOnly) {
                expect(post.preloads, "preloads:unrelated-absent").not.toContain(href);
            }
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
        test("react hmr", async ({ page }) => {
            await page.goto(f.url());
            await waitForHydration(page);
            await using _ = await expectNoReload(page);

            await testClient(page);

            let jsFile = f.createEditor("src/routes/page.tsx");
            jsFile.edit(s => s.replace("Count:", "Count-edit:"));
            await expect(page.locator(".counter-card")).toContainText("Count-edit: 1");

            let res = await page.request.get(page.url());
            expect(await res.text()).toContain("Count-edit");

            jsFile.reset();
            await expect(page.locator(".counter-card")).toContainText("Count: 1");
            await testCss(page);
        });

        test("hmr css", async ({ page }) => {
            await page.goto(f.url());
            await waitForHydration(page);
            await using _ = await expectNoReload(page);

            await testClient(page);

            let cssFile = f.createEditor("src/routes/page.css");
            cssFile.edit(s => s.replace("color: rgb(100, 108, 255);", "color: rgb(0, 0, 255);"));
            await expect(page.getByRole("heading", { name: "React Router Custom Framework" })).toHaveCSS(
                "color",
                "rgb(0, 0, 255)",
            );
            cssFile.reset();
            await testCss(page);
        });

        // routes:glob-discovery — a page added to the glob is routed with its
        // own stylesheet, and removing it drops both, with no asset list edited.
        test("globbed route added and removed", async ({ page }) => {
            let css = f.createFile("src/routes/added/added.css", ".added-page { color: rgb(1, 2, 3); }\n");
            let pageFile = f.createFile(
                "src/routes/added/page.tsx",
                'import "./added.css";\n\nexport function Component() {\n  return <main><h1 className="added-page">Added page</h1></main>;\n}\n',
            );

            await expect
                .poll(async () => {
                    let res = await page.request.get(f.url("/added"));
                    return res.ok() && (await res.text()).includes("Added page");
                })
                .toBe(true);
            let added = await expectDocumentAssets(page, f, "/added");
            expect(added.stylesheets.some(h => h.includes("added.css")), "routes:glob-discovery").toBe(true);
            let home = await expectDocumentAssets(page, f, "/");
            expect(home.stylesheets.some(h => h.includes("added.css")), "css:matched-route").toBe(false);

            await page.goto(f.url("/added"));
            await expect(page.getByRole("heading", { name: "Added page" })).toHaveCSS("color", "rgb(1, 2, 3)");

            pageFile.remove();
            css.remove();
            await expect
                .poll(async () => (await (await page.request.get(f.url("/added"))).text()).includes("Added page"))
                .toBe(false);
            await expectDocumentAssets(page, f, "/");
        });
    }
}

async function testClient(page: Page) {
    await expect(page.locator(".counter-card")).toContainText("Count: 0");
    await page.getByRole("button", { name: "Increment" }).click();
    await expect(page.locator(".counter-card")).toContainText("Count: 1");
}

async function testCss(page: Page) {
    // layout.css
    await expect(page.getByRole("button", { name: "Increment" })).toHaveCSS("background-color", "rgb(83, 91, 242)");
    // routes/page.css
    await expect(page.getByRole("heading", { name: "React Router Custom Framework" })).toHaveCSS(
        "color",
        "rgb(100, 108, 255)",
    );
}

async function testNavigation(page: Page) {
    await page.getByRole("link", { name: "About" }).click();
    await page.waitForURL("**/about");
    await expect(page.getByRole("heading", { name: "About" })).toBeVisible();

    await page.getByRole("link", { name: "Blog" }).click();
    await page.waitForURL("**/blog");
    await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible();

    await page.getByRole("link", { name: "Hello World" }).click();
    await page.waitForURL("**/blog/hello-world");
    await expect(page.getByRole("heading", { name: "Hello World" })).toBeVisible();
}
