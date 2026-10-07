import { existsSync, readdirSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createBuilder } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { serveFixture } from "./harness.ts";

const FIXTURE = join(import.meta.dirname, "../fixtures/node-app");
const DEV_PORT = 7311;
const PREVIEW_PORT = 7312;

// The fixture's server entry serves static files from "./dist/client", so
// build and preview run with the fixture as cwd — the same shape as running
// vite/vp inside a real project. (Dev runs chdir in its own harness process.)
let previousCwd = process.cwd();

beforeAll(async () => {
    process.chdir(FIXTURE);
    await rm(join(FIXTURE, "dist"), { recursive: true, force: true });
    let builder = await createBuilder({ root: FIXTURE, logLevel: "error" });
    await builder.buildApp();
});

afterAll(() => {
    process.chdir(previousCwd);
});

describe("production build", () => {
    it("serves HTML with resolved asset URLs from the built fetch handler", async () => {
        let entryUrl = pathToFileURL(join(FIXTURE, "dist/ssr/index.js")).href;
        let mod = await import(/* @vite-ignore */ entryUrl);
        let response = await mod.default.fetch(new Request("http://fixture.test/"));

        expect(response.status).toBe(200);
        let html = await response.text();

        // render({ assets }) resolved the island through the manifest: the
        // hydration record names its emitted chunk and export.
        expect(html).toContain(`"exportName":"Counter"`);
        let moduleUrl = /"moduleUrl":"(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
        expect(moduleUrl).toBeDefined();
        expect(existsSync(join(FIXTURE, "dist/client", moduleUrl!))).toBe(true);
        // ...and the renderer hoisted the island's preloads, its own chunk first.
        let islandPreloads = [
            ...html.matchAll(/<link[^>]*data-rmx-module-preload[^>]*href="([^"]+)"/g),
        ].map(match => match[1]);
        expect(islandPreloads[0]).toBe(moduleUrl);
        // client entry script tag
        expect(html).toMatch(/<script[^>]+src="\/assets\/entry\.browser-[^"']+\.js"/);

        // every referenced stylesheet exists in dist/client
        let cssHrefs = [...html.matchAll(/href="(\/assets\/[^"']+\.css)"/g)].map(match => match[1]);
        expect(cssHrefs.length).toBeGreaterThan(0);
        for (let href of cssHrefs) {
            expect(existsSync(join(FIXTURE, "dist/client", href))).toBe(true);
        }
    });

    it("leaves the server-update listener out of the client bundle", () => {
        // The browser entry wires revalidation behind `import.meta.hot`, which a
        // build replaces with `undefined`, so the branch never ships.
        let scripts = readdirSync(join(FIXTURE, "dist/client/assets"))
            .filter(file => file.endsWith(".js"))
            .map(file => readFileSync(join(FIXTURE, "dist/client/assets", file), "utf8"));

        expect(scripts.length).toBeGreaterThan(0);
        for (let script of scripts) {
            expect(script).not.toContain("server:update");
            expect(script).not.toContain("import.meta.hot");
        }
    });
});

describe("preview server", () => {
    it("serves the built fetch handler and its assets", async () => {
        let { preview } = await import("vite");
        let server = await preview({
            root: FIXTURE,
            logLevel: "error",
            preview: { host: "127.0.0.1", port: PREVIEW_PORT, strictPort: true },
        });

        try {
            let response = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/`);
            expect(response.status).toBe(200);
            let html = await response.text();
            expect(html).toContain("Node fixture");
            expect(html).toContain(`"exportName":"Counter"`);
            expect(html).toMatch(/"moduleUrl":"\/assets\/[^"]+\.js"/);

            // The stylesheet and client entry referenced by the HTML resolve
            // through the same preview server (staticFiles middleware).
            let hrefs = [...html.matchAll(/(?:href|src)="(\/assets\/[^"']+)"/g)].map(
                match => match[1],
            );
            expect(hrefs.length).toBeGreaterThan(0);
            for (let href of hrefs) {
                let asset = await fetch(`http://127.0.0.1:${PREVIEW_PORT}${href}`);
                expect(asset.status).toBe(200);
            }
        } finally {
            await server.close();
        }
    });
});

describe("dev server", () => {
    it("serves SSR HTML through the app's fetch handler with dev asset URLs", async () => {
        let [home, counter] = await serveFixture(FIXTURE, DEV_PORT, [
            { path: "/" },
            { path: "/app/counter.tsx" },
        ]);

        expect(home.status).toBe(200);
        expect(home.body).toContain("Node fixture");
        // the resolver returned the client entry's dev URL
        expect(home.body).toContain("/app/entry.browser.ts");
        expect(home.body).toContain(`"exportName":"Counter"`);
        expect(home.body).toContain(`"moduleUrl":"/app/counter.tsx"`);
        // the server graph's CSS is linked in dev
        expect(home.body).toContain("styles.css");

        // the module served to the browser carries the same portable identity
        // the server rendered with
        expect(counter.status).toBe(200);
        expect(counter.body).toContain(`"file:app/counter.tsx#Counter"`);
    });

    it("stays healthy after an aborted request", async () => {
        let [aborted, healthy] = await serveFixture(FIXTURE, DEV_PORT, [
            { path: "/", abort: true },
            { path: "/" },
        ]);

        expect(aborted.aborted).toBe(true);
        expect(healthy.status).toBe(200);
    });
});
