import { existsSync, readdirSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { build, preview } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const FIXTURE = join(import.meta.dirname, "../fixtures/spa-app");
const PREVIEW_PORT = 7321;

let previousCwd = process.cwd();

beforeAll(async () => {
    process.chdir(FIXTURE);
    await rm(join(FIXTURE, "dist"), { recursive: true, force: true });

    await build({ root: FIXTURE, logLevel: "error" });
});

afterAll(() => {
    process.chdir(previousCwd);
});

describe("SPA build", () => {
    it("emits a static site from index.html and no server bundle", () => {
        expect(existsSync(join(FIXTURE, "dist/index.html"))).toBe(true);
        expect(existsSync(join(FIXTURE, "dist/ssr"))).toBe(false);

        let html = readFileSync(join(FIXTURE, "dist/index.html"), "utf8");
        expect(html).toMatch(/<script type="module"[^>]+src="\/assets\/[^"]+\.js"/);

        let assets = readdirSync(join(FIXTURE, "dist/assets"));
        expect(assets.some(file => file.endsWith(".js"))).toBe(true);
        expect(assets.some(file => file.endsWith(".css"))).toBe(true);
    });

    it("leaves the HMR instrumentation out of the production bundle", () => {
        let assets = readdirSync(join(FIXTURE, "dist/assets"));
        let scripts = assets
            .filter(file => file.endsWith(".js"))
            .map(file => readFileSync(join(FIXTURE, "dist/assets", file), "utf8"));

        expect(scripts.length).toBeGreaterThan(0);
        for (let script of scripts) {
            expect(script).not.toContain("ui-hmr");
            expect(script).not.toContain("registerComponentForHmr");
        }
    });
});

describe("SPA preview server", () => {
    it("serves the shell for unknown paths so client routing resolves them", async () => {
        let server = await preview({
            root: FIXTURE,
            logLevel: "error",
            preview: { host: "127.0.0.1", port: PREVIEW_PORT, strictPort: true },
        });

        try {
            let home = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/`);
            expect(home.status).toBe(200);
            expect(await home.text()).toContain("SPA fixture");

            // A deep link has no file behind it; the SPA fallback hands back the
            // shell, which is what a static host must be configured to do too.
            let deepLink = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/guest-book`);
            expect(deepLink.status).toBe(200);
            expect(await deepLink.text()).toContain("SPA fixture");
        } finally {
            await server.close();
        }
    });
});
