import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createBuilder } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { serveFixture } from "./harness.ts";

const FIXTURE = join(import.meta.dirname, "../fixtures/custom-entry-app");
const DEV_PORT = 7341;

let previousCwd = process.cwd();

beforeAll(async () => {
    process.chdir(FIXTURE);
    await rm(join(FIXTURE, "dist"), { recursive: true, force: true });
});

afterAll(() => {
    process.chdir(previousCwd);
});

describe("proposal 0005: dev requests reach the configured server entry", () => {
    it("serves through a custom serverEntry instead of the default path", async () => {
        let [home, nested, stylesheet] = await serveFixture(FIXTURE, DEV_PORT, [
            { path: "/" },
            { path: "/some/page?q=1" },
            { path: "/stylesheet" },
        ]);

        expect(home.status).toBe(200);
        expect(home.body).toBe("custom entry /");
        expect(nested.body).toBe("custom entry /some/page");
        expect(stylesheet.body).toBe("/app/styles.css");
    });
});

describe("proposal 0005: a server-rendered app without a browser script", () => {
    it("still emits the stylesheets its server registers", async () => {
        let builder = await createBuilder({ root: FIXTURE, logLevel: "error" });
        await builder.buildApp();

        let entry = pathToFileURL(join(FIXTURE, "dist/ssr/index.js")).href;
        let mod = await import(/* @vite-ignore */ entry);
        let response = await mod.default.fetch(new Request("http://fixture.test/stylesheet"));
        let href = await response.text();

        expect(href).toMatch(/^\/assets\/styles-[^/]+\.css$/);
        expect(existsSync(join(FIXTURE, "dist/client", href))).toBe(true);
    });
});
