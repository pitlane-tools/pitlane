import { cloudflare } from "@cloudflare/vite-plugin";
import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { createBuilder, preview } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { remix } from "../../src/index.ts";
import { serveFixture } from "./harness.ts";

declare global {
    // Written by the fixture's test-env-build-counter plugin.
    var __envBuilds: string[] | undefined;
}

const FIXTURE = join(import.meta.dirname, "../fixtures/cloudflare-app");
const DEV_PORT = 7321;
const PREVIEW_PORT = 7322;

let previousCwd = process.cwd();

beforeAll(async () => {
    process.chdir(FIXTURE);
    await rm(join(FIXTURE, "dist"), { recursive: true, force: true });
});

afterAll(() => {
    process.chdir(previousCwd);
});

describe("dev server (workerd)", () => {
    it("serves SSR HTML rendered inside the Workers runtime", async () => {
        let [home] = await serveFixture(FIXTURE, DEV_PORT, [{ path: "/" }]);

        expect(home.status).toBe(200);
        // rendered by workerd, not Node
        expect(home.body).toContain("Cloudflare-Workers");
        // bindings resolved through cloudflare:workers
        expect(home.body).toContain(`data-env="true"`);
        // clientEntry transform ran in the workerd ssr environment
        expect(home.body).toContain(`"exportName":"Counter"`);
        expect(home.body).toContain(`"moduleUrl":"/app/counter.tsx"`);
    });
});

describe("production build", () => {
    it("builds every environment exactly once alongside the platform orchestrator", async () => {
        globalThis.__envBuilds = [];

        let builder = await createBuilder({ root: FIXTURE, logLevel: "error" });
        await builder.buildApp();

        expect(existsSync(join(FIXTURE, "dist/ssr/index.js"))).toBe(true);
        expect(existsSync(join(FIXTURE, "dist/client"))).toBe(true);

        let builds = globalThis.__envBuilds ?? [];
        let counts = new Map<string, number>();
        for (let name of builds) {
            counts.set(name, (counts.get(name) ?? 0) + 1);
        }
        expect(counts.get("ssr")).toBe(1);
        expect(counts.get("client")).toBe(1);
        for (let [name, count] of counts) {
            expect(count, `environment "${name}" built ${count} times`).toBe(1);
        }
    });
});

describe("preview server (workerd)", () => {
    it("lets the platform preview take over when the bundle is not Node-importable", async () => {
        let server = await preview({
            root: FIXTURE,
            logLevel: "error",
            preview: { host: "127.0.0.1", port: PREVIEW_PORT, strictPort: true },
        });

        try {
            let response = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/`);
            expect(response.status).toBe(200);
            let html = await response.text();

            expect(html).toContain("Cloudflare-Workers");
            expect(html).toContain(`data-env="true"`);
            expect(html).toContain(`"exportName":"Counter"`);
            expect(html).toMatch(/"moduleUrl":"\/assets\/[^"]+\.js"/);
        } finally {
            await server.close();
        }
    });
});

describe("prerender (workerd)", () => {
    beforeAll(async () => {
        await rm(join(FIXTURE, "dist"), { recursive: true, force: true });

        // The fixture's own config leaves prerendering off, so the other cases
        // keep an empty dist/client and their requests reach the worker rather
        // than a static file. This case composes the same two plugins with it on.
        let builder = await createBuilder({
            root: FIXTURE,
            configFile: false,
            logLevel: "error",
            plugins: [
                remix({ serverHandler: false, prerender: true }),
                cloudflare({ viteEnvironment: { name: "ssr" } }),
            ],
        });
        await builder.buildApp();
    });

    it("renders through the platform preview server and writes real workerd HTML", () => {
        let html = readFileSync(join(FIXTURE, "dist/client/index.html"), "utf8");

        // Rendered by workerd, with its bindings, against the built assets.
        expect(html).toContain("Cloudflare-Workers");
        expect(html).toContain(`data-env="true"`);
        expect(html).toMatch(/"moduleUrl":"\/assets\/[^"]+\.js"/);
    });

    it("routes frame requests around prerendered documents and asset redirects", async () => {
        let server = await preview({
            root: FIXTURE,
            logLevel: "error",
            preview: { host: "127.0.0.1", port: PREVIEW_PORT, strictPort: true },
        });

        try {
            for (let path of ["/", "/page", "/page/"]) {
                for (let headers of [
                    new Headers({ "x-remix-frame": "true" }),
                    new Headers({ "x-remix-target": "main" }),
                    new Headers({ "x-remix-frame": "true", "x-remix-target": "main" }),
                ]) {
                    let response = await fetch(`http://127.0.0.1:${PREVIEW_PORT}${path}`, {
                        headers,
                        redirect: "manual",
                    });
                    expect(response.status, path).toBe(200);
                    let html = await response.text();
                    expect(html).toContain(`data-page="${path}"`);
                    expect(html).not.toMatch(/<(?:html|head|body|header|footer|main)(?:\s|>)/i);
                }
            }
        } finally {
            await server.close();
        }
    });

    it("keeps static documents and assets while falling back to runtime routes", async () => {
        let server = await preview({
            root: FIXTURE,
            logLevel: "error",
            preview: { host: "127.0.0.1", port: PREVIEW_PORT, strictPort: true },
        });
        let origin = `http://127.0.0.1:${PREVIEW_PORT}`;

        try {
            let html = readFileSync(join(FIXTURE, "dist/client/page/index.html"), "utf8");
            let redirect = await fetch(`${origin}/page`, { redirect: "manual" });
            expect(redirect.status).toBe(307);
            expect(new URL(redirect.headers.get("location")!, origin).pathname).toBe("/page/");
            let document = await fetch(`${origin}/page/`);
            expect(document.status).toBe(200);
            // A fresh render generates new frame/island IDs; static output preserves them.
            expect(await document.text()).toBe(html);
            let head = await fetch(`${origin}/page/`, { method: "HEAD" });
            expect(head.status).toBe(200);
            expect(head.headers.get("content-type")).toContain("text/html");
            expect(await head.text()).toBe("");

            let assetPath = /"moduleUrl":"([^"]+\.js)"/.exec(html)![1]!;
            let asset = await fetch(`${origin}${assetPath}`);
            expect(asset.status).toBe(200);
            expect(await asset.text()).toBe(
                readFileSync(join(FIXTURE, "dist/client", assetPath), "utf8"),
            );

            let live = await fetch(`${origin}/live/example`);
            expect(live.status).toBe(200);
            expect(await live.text()).toContain('data-page="/live/example"');
            let submission = await fetch(`${origin}/page`, { method: "POST", redirect: "manual" });
            expect(submission.status).toBe(201);
            expect(await submission.text()).toBe("submitted");
            expect((await fetch(`${origin}/missing`)).status).toBe(404);
        } finally {
            await server.close();
        }
    });

    it.skipIf(!existsSync(chromium.executablePath()))(
        "soft-navigates prerendered pages without duplicating the document shell",
        async () => {
            let server = await preview({
                root: FIXTURE,
                logLevel: "error",
                preview: { host: "127.0.0.1", port: PREVIEW_PORT, strictPort: true },
            });
            let browser = await chromium.launch({ headless: true });

            try {
                let page = await browser.newPage();
                await page.goto(`http://127.0.0.1:${PREVIEW_PORT}/`, { waitUntil: "networkidle" });
                await page.click("button");
                for (let path of ["/page", "/"]) {
                    await page.click(`header a[href="${path}"]`);
                    await page.waitForSelector(
                        `main [data-page="${path}"], main [data-page="${path}/"]`,
                    );
                    expect(await page.locator("header").count()).toBe(1);
                    expect(await page.locator("footer").count()).toBe(1);
                    expect(await page.locator("main").count()).toBe(1);
                    expect(await page.locator("main footer, main main, main head").count()).toBe(0);
                    expect(await page.locator("[data-count]").textContent()).toBe("1");
                }
            } finally {
                await browser.close();
                await server.close();
            }
        },
    );
});
