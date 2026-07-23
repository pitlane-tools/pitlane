import type { Plugin, PluginOption, ViteDevServer } from "vite";

import { describe, expect, it } from "vitest";

import { remix } from "../src/index.ts";

function pluginsOf(option: PluginOption): Plugin[] {
    if (!Array.isArray(option)) throw new Error("expected remix() to return a plugin array");
    // remix() returns a flat array of plugins (fullstack itself contributes a
    // nested array); flatten one level and keep the named plugin objects.
    return option
        .flat()
        .filter((entry): entry is Plugin => typeof entry === "object" && entry !== null);
}

describe("remix()", () => {
    it("composes the fullstack plugins with the remix plugins", () => {
        let names = pluginsOf(remix()).map(plugin => plugin.name);

        expect(names).toContain("pitlane-remix-build:compat");
        expect(names).toContain("pitlane-remix-build");
        expect(names).toContain("pitlane-remix-preview-server");
        expect(names).toContain("pitlane-remix-suppress-abort-errors");
        expect(names).toContain("pitlane-remix-client-entry-transform");
        // At least one plugin comes from the wrapped assets/server-handler engine.
        expect(names.some(name => name.startsWith("fullstack"))).toBe(true);
    });

    it("configures dist/ssr and dist/client environments by default", () => {
        let plugin = pluginsOf(remix()).find(entry => entry.name === "pitlane-remix-build");
        if (!plugin || typeof plugin.config !== "function") {
            throw new Error("pitlane-remix-build must define a function config hook");
        }
        let config = plugin.config.call(undefined, {}, { command: "build", mode: "production" });

        expect(config).toMatchObject({
            builder: {},
            build: { assetsInlineLimit: 0 },
            environments: {
                client: {
                    build: {
                        outDir: "dist/client",
                        rollupOptions: { input: "app/entry.browser" },
                    },
                },
                ssr: {
                    build: {
                        outDir: "dist/ssr",
                        rollupOptions: { input: { index: "app/entry.server" } },
                    },
                },
            },
        });
    });

    it("omits the client environment when clientEntry is false", () => {
        let plugin = pluginsOf(remix({ clientEntry: false })).find(
            entry => entry.name === "pitlane-remix-build",
        );
        if (!plugin || typeof plugin.config !== "function") {
            throw new Error("pitlane-remix-build must define a function config hook");
        }
        let config = plugin.config.call(undefined, {}, { command: "build", mode: "production" });

        expect(config?.environments).not.toHaveProperty("client");
        expect(config?.environments).toHaveProperty("ssr");
    });
});

describe("pitlane-remix-suppress-abort-errors", () => {
    function captureErrorMiddleware(): (err: unknown, next: (err?: unknown) => void) => void {
        let plugin = pluginsOf(remix()).find(
            entry => entry.name === "pitlane-remix-suppress-abort-errors",
        );
        if (!plugin || typeof plugin.configureServer !== "function") {
            throw new Error("expected a function configureServer hook");
        }

        let captured: ((err: unknown, req: unknown, res: unknown, next: unknown) => void) | null =
            null;
        let fakeServer = {
            middlewares: {
                use(handler: (err: unknown, req: unknown, res: unknown, next: unknown) => void) {
                    captured = handler;
                },
            },
            // The hook only touches server.middlewares.use; the cast is the
            // test seam that avoids booting a real dev server.
        } as unknown as ViteDevServer;

        let register = plugin.configureServer.call(undefined, fakeServer);
        if (typeof register !== "function") {
            throw new Error("expected configureServer to defer middleware registration");
        }
        register();
        if (!captured) throw new Error("expected an error middleware to be registered");

        let middleware: (err: unknown, req: unknown, res: unknown, next: unknown) => void =
            captured;
        return (err, next) => middleware(err, {}, {}, next);
    }

    it("swallows aborted-request errors", () => {
        let run = captureErrorMiddleware();
        let forwarded: unknown[] = [];

        run(new Error("aborted"), err => forwarded.push(err));

        expect(forwarded).toHaveLength(0);
    });

    it("forwards every other error", () => {
        let run = captureErrorMiddleware();
        let forwarded: unknown[] = [];
        let boom = new Error("boom");

        run(boom, err => forwarded.push(err));

        expect(forwarded).toEqual([boom]);
    });
});
