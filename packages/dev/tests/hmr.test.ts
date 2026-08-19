import type { Plugin } from "vite";

import { describe, expect, it } from "vitest";

import { REVALIDATION_CLAIM } from "../src/hmr-protocol.ts";
import { componentHmr, serverDataHmr } from "../src/hmr.ts";
import { acceptServerUpdates } from "../src/runtime.ts";
import { clientEntryTransform } from "../src/transform.ts";

type TransformResult = { code: string; map?: unknown } | undefined | null | void;
type TransformHandler = (
    this: { environment: { name: string; config: { root: string } } },
    code: string,
    id: string,
) => TransformResult | Promise<TransformResult>;

async function runTransform(
    plugin: Plugin,
    environment: string,
    code: string,
    id: string,
    root = "/project",
): Promise<TransformResult> {
    let hook = plugin.transform;
    if (!hook || typeof hook === "function") {
        throw new Error("expected an object-form transform hook with a filter");
    }
    let handler = hook.handler as TransformHandler;
    return await handler.call({ environment: { name: environment, config: { root } } }, code, id);
}

// Narrows a transform result to its emitted code, failing the test when the
// hook unexpectedly skipped the module.
function codeOf(result: TransformResult): string {
    if (!result || typeof result !== "object" || typeof result.code !== "string") {
        throw new Error("expected a transform result with code");
    }
    return result.code;
}

const FUNCTION_ENTRY = `import { clientEntry } from "remix/ui";
export const Counter = clientEntry(import.meta.url, function Counter(handle) {
    return () => null;
});
`;

const ARROW_ENTRY = `import { clientEntry } from "remix/ui";
export const Counter = clientEntry(import.meta.url, handle => {
    return () => null;
});
`;

const FUNCTION_COMPONENT = `export function Card(handle) {
    return () => null;
}
`;

const ARROW_EXPR_ENTRY = `import { clientEntry } from "remix/ui";
export const Counter = clientEntry(import.meta.url, (handle) => () => null);
`;

const ARROW_COMPONENT = `export const Card = (handle) => {
    return () => null;
};
`;

const NON_COMPONENT_ARROW = `export const NotAComponent = () => 42;
export const helper = (handle) => () => null;
`;

describe("componentHmr", () => {
    it("is a dev-only plugin", () => {
        let plugin = componentHmr(new Set(["ssr"]));
        expect(plugin.name).toBe("pitlane-remix-component-hmr");
        expect(plugin.apply).toBe("serve");
    });

    it("instruments function-form components in the client environment for browser HMR", async () => {
        let plugin = componentHmr(new Set(["ssr"]));
        let code = codeOf(
            await runTransform(plugin, "client", FUNCTION_ENTRY, "/project/app/counter.tsx"),
        );

        expect(code).toContain("remix/ui-hmr/runtime/browser");
        expect(code).toContain("import.meta.hot.accept");
        expect(code).toContain("updateComponentModuleForHmr");
    });

    it("instruments components in a server environment through the server transform", async () => {
        let plugin = componentHmr(new Set(["ssr"]));
        let code = codeOf(
            await runTransform(plugin, "ssr", FUNCTION_COMPONENT, "/project/app/card.tsx"),
        );

        expect(code).toContain("remix/ui-hmr/runtime/server");
        // The browser-only refresh runtime never leaks into the server output.
        expect(code).not.toContain("remix/ui-hmr/runtime/browser");
    });

    it("hot-swaps arrow-form clientEntry islands by normalizing them to functions", async () => {
        let plugin = componentHmr(new Set(["ssr"]));
        let block = codeOf(await runTransform(plugin, "client", ARROW_ENTRY, "/project/app/a.tsx"));
        let expr = codeOf(
            await runTransform(plugin, "client", ARROW_EXPR_ENTRY, "/project/app/b.tsx"),
        );

        for (let code of [block, expr]) {
            expect(code).toContain("remix/ui-hmr/runtime/browser");
            expect(code).toContain("import.meta.hot.accept");
            // The arrow was normalized to a named function before instrumentation.
            expect(code).toContain("function Counter");
        }
    });

    it("hot-swaps arrow-form component exports", async () => {
        let plugin = componentHmr(new Set(["ssr"]));
        let code = codeOf(
            await runTransform(plugin, "client", ARROW_COMPONENT, "/project/app/card.tsx"),
        );

        expect(code).toContain("import.meta.hot.accept");
        expect(code).toContain("function Card");
    });

    it("leaves non-component arrows untouched", async () => {
        let plugin = componentHmr(new Set(["ssr"]));
        let result = await runTransform(
            plugin,
            "client",
            NON_COMPONENT_ARROW,
            "/project/app/misc.tsx",
        );

        expect(result).toBeUndefined();
    });

    it("leaves modules without components untouched", async () => {
        let plugin = componentHmr(new Set(["ssr"]));
        let result = await runTransform(
            plugin,
            "client",
            `export const config = { title: "hi" };\n`,
            "/project/app/config.tsx",
        );

        expect(result).toBeUndefined();
    });
});

describe("serverDataHmr", () => {
    it("is a dev-only plugin", () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        expect(plugin.name).toBe("pitlane-remix-server-data-hmr");
        expect(plugin.apply).toBe("serve");
    });

    it("resolves and loads the client dev runtime virtual module", () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        let resolveId = plugin.resolveId as (this: unknown, id: string) => string | undefined;
        let load = plugin.load as (this: unknown, id: string) => string | undefined;

        let resolved = resolveId.call({}, "virtual:pitlane-dev/server-data-hmr");
        expect(resolved).toBe("\0virtual:pitlane-dev/server-data-hmr");

        let source = load.call({}, "\0virtual:pitlane-dev/server-data-hmr");
        expect(source).toContain('import.meta.hot.on("pitlane:server-update"');
        expect(source).toContain("navigate(location.href");
    });

    it("injects the dev runtime import into the client entry only", async () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");

        let entry = codeOf(
            await runTransform(
                plugin,
                "client",
                `import { run } from "remix/ui";\nrun({});\n`,
                "/project/app/entry.browser.ts",
            ),
        );
        expect(entry).toContain('import "virtual:pitlane-dev/server-data-hmr";');

        let other = await runTransform(
            plugin,
            "client",
            `export const x = 1;\n`,
            "/project/app/other.ts",
        );
        expect(other).toBeUndefined();
    });

    it("does not inject the dev runtime in a server environment", async () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        let result = await runTransform(
            plugin,
            "ssr",
            `import { run } from "remix/ui";\n`,
            "/project/app/entry.browser.ts",
        );
        expect(result).toBeUndefined();
    });
});

type HotUpdateContext = { environment: { name: string } };
type HotUpdateModule = { file: string | null };
type ClientModuleGraphEntry = { type: string };

async function runHotUpdate(
    plugin: Plugin,
    environment: string,
    modules: HotUpdateModule[],
    clientGraphFiles: Record<string, ClientModuleGraphEntry[]>,
    file = modules[0]?.file ?? "/project/app/unknown.ts",
): Promise<Array<{ type: string; event?: string }>> {
    let hook = plugin.hotUpdate;
    if (typeof hook !== "function") throw new Error("expected a function hotUpdate hook");
    let invoke = hook as unknown as (
        this: HotUpdateContext,
        options: { file: string; modules: HotUpdateModule[]; server: unknown },
    ) => void;

    let sent: Array<{ type: string; event?: string }> = [];
    let server = {
        hot: {
            send(payload: { type: string; event?: string }) {
                sent.push(payload);
            },
        },
        environments: {
            client: {
                moduleGraph: {
                    getModulesByFile(moduleFile: string) {
                        let entries = clientGraphFiles[moduleFile];
                        return entries ? new Set(entries) : undefined;
                    },
                },
            },
        },
    };

    invoke.call({ environment: { name: environment } }, { file, modules, server });
    await settleServerUpdate();
    return sent;
}

/** Outlasts the plugin's server-update settle window. */
function settleServerUpdate(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 120));
}

describe("serverDataHmr hotUpdate", () => {
    it("broadcasts a server-update when a server-only module changes", async () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        let sent = await runHotUpdate(plugin, "ssr", [{ file: "/project/app/document.tsx" }], {});

        expect(sent).toEqual([{ type: "custom", event: "pitlane:server-update" }]);
    });

    it("stays quiet when the client graph serves the file as a script", async () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        let sent = await runHotUpdate(plugin, "ssr", [{ file: "/project/app/counter.tsx" }], {
            "/project/app/counter.tsx": [{ type: "js" }],
        });

        expect(sent).toEqual([]);
    });

    it("broadcasts when the client graph only holds a non-script node for the file", async () => {
        // Tailwind's content scanner registers `asset` nodes for ordinary server
        // files; treating those as client modules disables server-data HMR.
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        let sent = await runHotUpdate(plugin, "ssr", [{ file: "/project/app/routes.tsx" }], {
            "/project/app/routes.tsx": [{ type: "asset" }],
        });

        expect(sent).toEqual([{ type: "custom", event: "pitlane:server-update" }]);
    });

    it("broadcasts when the changed server file has no invalidated modules", async () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        let sent = await runHotUpdate(plugin, "ssr", [], {}, "/project/app/actions/projects.tsx");

        expect(sent).toEqual([{ type: "custom", event: "pitlane:server-update" }]);
    });

    it("coalesces a burst of server changes into one revalidation", async () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        let hook = plugin.hotUpdate;
        if (typeof hook !== "function") throw new Error("expected a function hotUpdate hook");

        let sent: Array<{ type: string; event?: string }> = [];
        let server = {
            hot: { send: (payload: { type: string; event?: string }) => sent.push(payload) },
            environments: {},
        };
        let invoke = hook as unknown as (
            this: HotUpdateContext,
            options: { file: string; modules: HotUpdateModule[]; server: unknown },
        ) => void;

        for (let file of ["/project/app/a.ts", "/project/app/b.ts", "/project/app/c.ts"]) {
            invoke.call({ environment: { name: "ssr" } }, { file, modules: [{ file }], server });
        }
        await settleServerUpdate();

        expect(sent).toEqual([{ type: "custom", event: "pitlane:server-update" }]);
    });

    it("ignores updates outside the server environment", async () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        let sent = await runHotUpdate(
            plugin,
            "client",
            [{ file: "/project/app/document.tsx" }],
            {},
        );

        expect(sent).toEqual([]);
    });
});

describe("componentHmr details", () => {
    it("keys the browser registry on the module id", async () => {
        let plugin = componentHmr(new Set(["ssr"]));
        let code = codeOf(
            await runTransform(plugin, "client", FUNCTION_ENTRY, "/project/app/counter.tsx"),
        );

        // The wrapper and its registration agree on the same module key, so the
        // component stays identifiable across updates.
        expect(code).toContain('"/project/app/counter.tsx", "Counter"');
    });

    it("emits a source map for transformed modules", async () => {
        let plugin = componentHmr(new Set(["ssr"]));
        let result = await runTransform(
            plugin,
            "client",
            FUNCTION_ENTRY,
            "/project/app/counter.tsx",
        );

        if (!result || typeof result !== "object") throw new Error("expected a transform result");
        expect(result.map).toBeTruthy();
    });
});

describe("serverDataHmr hotUpdate edge cases", () => {
    it("ignores non-script files even when no modules were invalidated", async () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        expect(await runHotUpdate(plugin, "ssr", [], {}, "/project/app/content.md")).toEqual([]);
    });

    it("broadcasts when there is no client environment to check against", async () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        let hook = plugin.hotUpdate;
        if (typeof hook !== "function") throw new Error("expected a function hotUpdate hook");

        let sent: Array<{ type: string; event?: string }> = [];
        let server = {
            hot: { send: (payload: { type: string; event?: string }) => sent.push(payload) },
            environments: {},
        };
        let invoke = hook as unknown as (
            this: { environment: { name: string } },
            options: {
                file: string;
                modules: Array<{ file: string | null }>;
                server: unknown;
            },
        ) => void;
        invoke.call(
            { environment: { name: "ssr" } },
            {
                file: "/project/app/document.tsx",
                modules: [{ file: "/project/app/document.tsx" }],
                server,
            },
        );
        await settleServerUpdate();
        expect(sent).toEqual([{ type: "custom", event: "pitlane:server-update" }]);
    });
});

describe("componentHmr composes with clientEntryTransform", () => {
    async function runClientEntry(env: string, code: string, id: string): Promise<TransformResult> {
        let plugin = clientEntryTransform(new Set(["ssr"]));
        let hook = plugin.transform;
        if (!hook || typeof hook === "function") {
            throw new Error("expected an object-form transform hook");
        }
        return await (hook.handler as TransformHandler).call(
            { environment: { name: env, config: { root: "/project" } } },
            code,
            id,
        );
    }

    it("keeps the clientEntry URL rewrite after the ui-hmr transform (client)", async () => {
        let id = "/project/app/counter.tsx";
        let instrumented = codeOf(
            await runTransform(componentHmr(new Set(["ssr"])), "client", FUNCTION_ENTRY, id),
        );
        let final = codeOf(await runClientEntry("client", instrumented, id));

        // The ui-hmr accept boundary survives the second transform...
        expect(final).toContain("import.meta.hot.accept");
        expect(final).toContain("getCurrentComponentForHmr");
        // ...and the clientEntry URL fragment rewrite is applied on top of it.
        expect(final).toContain('import.meta.url + "#Counter"');
    });

    it("resolves the client asset URL on the server after the ui-hmr transform", async () => {
        let id = "/project/app/counter.tsx";
        let instrumented = codeOf(
            await runTransform(componentHmr(new Set(["ssr"])), "ssr", FUNCTION_ENTRY, id),
        );
        let final = codeOf(await runClientEntry("ssr", instrumented, id));

        expect(final).toContain("?assets=client");
        expect(final).toContain('.entry + "#Counter"');
    });
});

describe("acceptServerUpdates", () => {
    it("is inert without a hot context, so production and SSR never touch a frame", () => {
        let reloads = 0;
        let handle = { frames: { top: { reload: () => reloads++ } } };

        // No `import.meta.hot` here, which is what a production build and a
        // non-Vite consumer look like.
        expect(() => acceptServerUpdates(handle)).not.toThrow();
        expect(reloads).toBe(0);
        expect((globalThis as Record<string, unknown>)[REVALIDATION_CLAIM]).toBeUndefined();
    });
});
