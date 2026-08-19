import { existsSync, readdirSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
});

afterAll(() => {
    process.chdir(previousCwd);
});

describe("production build", () => {
    it("builds ssr first, then client, with hashed assets", async () => {
        let { createBuilder } = await import("vite");
        let builder = await createBuilder({ root: FIXTURE, logLevel: "error" });
        await builder.buildApp();

        expect(existsSync(join(FIXTURE, "dist/ssr/index.js"))).toBe(true);

        let assets = readdirSync(join(FIXTURE, "dist/client/assets"));
        expect(assets.some(file => file.endsWith(".js"))).toBe(true);
        expect(assets.some(file => file.endsWith(".css"))).toBe(true);
    });

    it("inlines this package's runtime instead of importing it at run time", async () => {
        // The fixture imports `@pitlane/dev/runtime` the way an app does, and
        // @pitlane/dev is a devDependency: a bare import of it (or of anything
        // it pulls in) would fail on a pruned production install.
        let bundle = readFileSync(join(FIXTURE, "dist/ssr/index.js"), "utf8");
        let bareImports = [...bundle.matchAll(/^import[^'"]*['"]([^.'"][^'"]*)['"]/gm)].map(
            match => match[1],
        );

        expect(bareImports.length).toBeGreaterThan(0);
        expect(bareImports.filter(specifier => !specifier.startsWith("remix/"))).toEqual([]);
    });

    it("serves HTML with resolved asset URLs from the built fetch handler", async () => {
        let entryUrl = pathToFileURL(join(FIXTURE, "dist/ssr/index.js")).href;
        let mod = await import(/* @vite-ignore */ entryUrl);
        let response = await mod.default.fetch(new Request("http://fixture.test/"));

        expect(response.status).toBe(200);
        let html = await response.text();

        // clientEntry transform (server environment): the hydration data
        // script references the hashed client chunk and export name.
        expect(html).toContain(`"exportName":"Counter"`);
        expect(html).toMatch(/"moduleUrl":"\/assets\/[^"]+\.js"/);
        // client entry script tag
        expect(html).toMatch(/<script[^>]+src="\/assets\/[^"']+\.js"/);

        // every referenced stylesheet exists in dist/client
        let cssHrefs = [...html.matchAll(/href="(\/assets\/[^"']+\.css)"/g)].map(match => match[1]);
        expect(cssHrefs.length).toBeGreaterThan(0);
        for (let href of cssHrefs) {
            expect(existsSync(join(FIXTURE, "dist/client", href))).toBe(true);
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
        // server-environment transform resolved the dev URL of the client entry
        expect(home.body).toContain("entry.browser.ts");
        expect(home.body).toContain(`"exportName":"Counter"`);
        expect(home.body).toContain(`"moduleUrl":"/app/counter.tsx"`);
        // the SSR module's CSS is linked in dev
        expect(home.body).toContain("styles.css");

        // client-environment transform: the counter module served to the
        // browser appends the fragment to its own import.meta.url
        expect(counter.status).toBe(200);
        expect(counter.body).toContain(`import.meta.url + "#Counter"`);
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
