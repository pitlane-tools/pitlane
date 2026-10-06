import type { Browser } from "playwright";
import type { Plugin, ViteDevServer } from "vite";

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer, isRunnableDevEnvironment } from "vite";
import { afterEach, expect, it } from "vite-plus/test";

import { assets } from "../src/vite-plugin.ts";

let root: string;
let server: ViteDevServer;
let browser: Browser;

afterEach(async () => {
    await browser?.close();
    await server?.close();
    if (root) await rm(root, { recursive: true, force: true });
});

it("keeps linked and browser-imported CSS in cascade order through in-place edits", async () => {
    root = await mkdtemp(fileURLToPath(new URL("./.vite-css-", import.meta.url)));
    await mkdir(join(root, "app"));
    let files = {
        "entry.ts": `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
import "./component.ts";
let resolver = createAssetResolver(manifest);
export let script = await resolver.getScriptEntry("app/browser.ts");
export let stylesheets = await resolver.getStylesheets("app/entry.ts");`,
        "component.ts": 'import "./shared.css"; export const shared = true;',
        "browser.ts": `import "./component.ts";
let count = 0;
document.querySelector("button").onclick = event => { event.currentTarget.textContent = String(++count); };
document.body.dataset.ready = "yes";`,
        "shared.css": ".target { color: rgb(255, 0, 0); background-color: rgb(1, 2, 3); }",
    };
    await Promise.all(
        Object.entries(files).map(([file, code]) => writeFile(join(root, "app", file), code)),
    );
    let application: Plugin = {
        name: "plain-html-test-application",
        configureServer(vite) {
            return () =>
                vite.middlewares.use(async (_request, response, next) => {
                    try {
                        let environment = vite.environments.ssr;
                        if (!isRunnableDevEnvironment(environment))
                            throw new Error("Expected a runnable test environment");
                        let entry = await environment.runner.import("/app/entry.ts");
                        response.setHeader("content-type", "text/html");
                        response.end(`<!doctype html><html><head>${entry.stylesheets.map((href: string) => `<link rel="stylesheet" href="${href}">`).join("")}
<style>.target { color: rgb(0, 0, 255); }</style></head><body><button class="target">0</button>
<script type="module" src="/@vite/client"></script><script type="module" src="${entry.script.href}"></script></body></html>`);
                    } catch (error) {
                        next(error);
                    }
                });
        },
    };
    server = await createServer({
        root,
        configFile: false,
        appType: "custom",
        logLevel: "error",
        resolve: {
            alias: [
                {
                    find: /^@pitlane\/assets$/,
                    replacement: fileURLToPath(new URL("../src/index.ts", import.meta.url)),
                },
            ],
        },
        plugins: [assets(), application],
        environments: { ssr: { build: { rolldownOptions: { input: "app/entry.ts" } } } },
        server: { host: "127.0.0.1", port: 0 },
    });
    await server.listen();
    browser = await chromium.launch({ headless: true });
    let page = await browser.newPage();
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.waitForSelector('body[data-ready="yes"]');
    expect(await page.locator("button").evaluate(element => getComputedStyle(element).color)).toBe(
        "rgb(0, 0, 255)",
    );
    await page.click("button");
    await writeFile(
        join(root, "app/shared.css"),
        files["shared.css"].replace("rgb(1, 2, 3)", "rgb(4, 5, 6)"),
    );
    await expect
        .poll(() =>
            page.locator("button").evaluate(element => getComputedStyle(element).backgroundColor),
        )
        .toBe("rgb(4, 5, 6)");
    expect(await page.locator("button").evaluate(element => getComputedStyle(element).color)).toBe(
        "rgb(0, 0, 255)",
    );
    expect(await page.locator("button").textContent()).toBe("1");
});
