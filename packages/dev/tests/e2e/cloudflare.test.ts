import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

        let { createBuilder } = await import("vite");
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

            expect(html).toContain("Cloudflare-Workers");
            expect(html).toContain(`data-env="true"`);
            expect(html).toContain(`"exportName":"Counter"`);
            expect(html).toMatch(/"moduleUrl":"\/assets\/[^"]+\.js"/);
        } finally {
            await server.close();
        }
    });
});
