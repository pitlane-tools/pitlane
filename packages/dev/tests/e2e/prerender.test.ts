import type { InlineConfig } from "vite";

import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { createBuilder } from "vite";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrerenderOption } from "../../src/prerender.ts";

import { remix } from "../../src/index.ts";

const FIXTURE = join(import.meta.dirname, "../fixtures/prerender-app");
const OUT = join(FIXTURE, "dist/client");

// The fixture's own vite.config.ts documents the shape; the suite drives the
// plugin directly so each case can build a different prerender config without
// a fixture per case.
async function buildFixture(
    prerender: PrerenderOption,
    overrides: Partial<InlineConfig> = {},
): Promise<void> {
    let builder = await createBuilder({
        root: FIXTURE,
        configFile: false,
        logLevel: "error",
        plugins: [remix({ prerender })],
        ...overrides,
    });
    await builder.buildApp();
}

function read(relative: string): string {
    return readFileSync(join(OUT, relative), "utf8");
}

let previousCwd = process.cwd();

beforeEach(async () => {
    process.chdir(FIXTURE);
    await rm(join(FIXTURE, "dist"), { recursive: true, force: true });
});

afterAll(() => {
    process.chdir(previousCwd);
});

describe("prerender", () => {
    it("renders the paths a prerender function returns", async () => {
        await buildFixture(({ getStaticPaths }) => [
            ...getStaticPaths(),
            "/blog/hello-world",
            "/blog/second-post",
        ]);

        expect(existsSync(join(OUT, "index.html"))).toBe(true);
        expect(existsSync(join(OUT, "blog/index.html"))).toBe(true);
        expect(existsSync(join(OUT, "blog/hello-world/index.html"))).toBe(true);
        expect(existsSync(join(OUT, "blog/second-post/index.html"))).toBe(true);

        // Real server output, not a shell: the route's own data is in the file.
        expect(read("blog/hello-world/index.html")).toContain('data-slug="hello-world"');
        expect(read("blog/hello-world/index.html")).toContain("Hello world");
    });

    it("resolves hashed client assets in the prerendered HTML", async () => {
        await buildFixture(["/"]);

        let html = read("index.html");
        // Prerendering runs after the client build and the assets manifest, so
        // the HTML names the built chunk rather than a dev URL.
        expect(html).toMatch(/<script[^>]+src="\/assets\/entry\.browser-[^"]+\.js"/);
        expect(html).toMatch(/<link[^>]+href="\/assets\/[^"]+\.css"/);
        expect(html).not.toContain("entry.browser.ts");
    });

    it("prerenders every static route path when true", async () => {
        await buildFixture(true);

        expect(existsSync(join(OUT, "index.html"))).toBe(true);
        expect(existsSync(join(OUT, "blog/index.html"))).toBe(true);
        // /blog/:slug has no static value, so it is not a static path.
        expect(existsSync(join(OUT, "blog/hello-world/index.html"))).toBe(false);
    });

    it("prerenders exactly the paths an array lists", async () => {
        await buildFixture(["/blog"]);

        expect(existsSync(join(OUT, "blog/index.html"))).toBe(true);
        expect(existsSync(join(OUT, "index.html"))).toBe(false);
    });

    it("follows links from the given paths when spidering", async () => {
        await buildFixture({ paths: ["/"], spider: true });

        // "/" links to /blog, and /blog links to each post.
        expect(existsSync(join(OUT, "index.html"))).toBe(true);
        expect(existsSync(join(OUT, "blog/index.html"))).toBe(true);
        expect(existsSync(join(OUT, "blog/hello-world/index.html"))).toBe(true);
        expect(existsSync(join(OUT, "blog/second-post/index.html"))).toBe(true);
    });

    it("does not follow links without spidering", async () => {
        await buildFixture({ paths: ["/"] });

        expect(existsSync(join(OUT, "index.html"))).toBe(true);
        expect(existsSync(join(OUT, "blog/index.html"))).toBe(false);
    });

    it("writes output relative to the base rather than under it", async () => {
        await buildFixture(true, { base: "/repo/" });

        // The app's routes live under /repo/, so that is what gets fetched —
        // but the host mounts the whole directory at /repo/, so the files
        // belong at the top of the client output.
        expect(existsSync(join(OUT, "index.html"))).toBe(true);
        expect(existsSync(join(OUT, "blog/index.html"))).toBe(true);
        expect(existsSync(join(OUT, "repo/index.html"))).toBe(false);
        expect(read("blog/index.html")).toContain('href="/repo/blog/hello-world"');
    });

    it("reports a server entry with no route map", async () => {
        let builder = await createBuilder({
            root: FIXTURE,
            configFile: false,
            logLevel: "error",
            plugins: [remix({ serverEntry: "app/entry.no-routes.tsx", prerender: true })],
        });

        await expect(builder.buildApp()).rejects.toThrow(/export its route map/);
    });

    it("builds without prerendering when the option is absent", async () => {
        let builder = await createBuilder({
            root: FIXTURE,
            configFile: false,
            logLevel: "error",
            plugins: [remix()],
        });
        await builder.buildApp();

        expect(existsSync(join(FIXTURE, "dist/ssr/index.js"))).toBe(true);
        expect(existsSync(join(OUT, "index.html"))).toBe(false);
    });
});
