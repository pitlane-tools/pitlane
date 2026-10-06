// Behavior from hi-ogawa/vite-plugin-fullstack@28e9540 e2e/data-fetching.test.ts,
// plus the @pitlane/assets document contract (see helper.ts).
import { expect, test } from "@playwright/test";
import { type Fixture, useFixture } from "./fixture.ts";
import { collectErrors, expectDocumentAssets, waitForHydration } from "./helper.ts";

test.describe("data-fetching dev", () => {
    defineTest(useFixture({ example: "data-fetching", mode: "dev" }));
});

test.describe("data-fetching build", () => {
    defineTest(useFixture({ example: "data-fetching", mode: "build" }));
});

function defineTest(f: Fixture) {
    test("add new todo item", async ({ page }) => {
        let errors = collectErrors(page);
        await page.goto(f.url());
        await waitForHydration(page);

        // css:shared — app.css, imported by a module both graphs share
        await expect(page.locator(".todoapp h1")).toHaveCSS("color", "rgb(184, 63, 69)");

        // data:orpc+tanstack — mutations go through oRPC, refetch through TanStack Query
        await page.fill('input[placeholder="What needs to be done?"]', "Buy groceries");
        await page.press('input[placeholder="What needs to be done?"]', "Enter");
        await expect(page.locator("label", { hasText: "Buy groceries" })).toBeVisible();
        await expect(page.locator("input.new-todo")).toHaveValue("");

        // SSR reflects the server state
        let res = await page.request.get(page.url());
        expect(await res.text()).toContain("Buy groceries");
        expect(errors).toEqual([]);
    });

    test("document assets", async ({ page }) => {
        let { stylesheets } = await expectDocumentAssets(page, f);
        expect(stylesheets.length, "css:shared").toBeGreaterThan(0);
    });

    // rpc:untouched — the RPC endpoint answers without any asset involvement
    test("rpc endpoint", async ({ page }) => {
        let res = await page.request.post(f.url("/rpc/listItems"), {
            headers: { "content-type": "application/json" },
            data: {},
        });
        // Matched by oRPC (never falls through to the document renderer).
        expect(res.status()).not.toBe(404);
        expect(res.headers()["content-type"]).toMatch(/json/);
    });

    if (f.mode === "dev") {
        // module-read:refresh — the server entry reads assets at module scope;
        // a stylesheet import added to a shared module reaches the next document.
        test("module-level reads refresh after a css import change", async ({ page }) => {
            let added = f.createFile("src/added.css", ".todoapp h1 { outline: 3px solid rgb(1, 2, 3); }\n");
            let app = f.createEditor("src/app.tsx");
            app.edit(s => s.replace('import "./app.css";', 'import "./app.css";\nimport "./added.css";'));
            await expect
                .poll(async () => (await expectDocumentAssets(page, f)).stylesheets.some(h => h.includes("added.css")))
                .toBe(true);
            app.reset();
            await expect
                .poll(async () => (await expectDocumentAssets(page, f)).stylesheets.some(h => h.includes("added.css")))
                .toBe(false);
            added.remove();
        });
    }
}
