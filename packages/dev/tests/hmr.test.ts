import type { Plugin } from "vite";

import { describe, expect, it } from "vitest";

import { componentHmr, serverDataHmr } from "../src/hmr.ts";

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

    it("leaves arrow-function components untouched", async () => {
        let plugin = componentHmr(new Set(["ssr"]));
        let result = await runTransform(plugin, "client", ARROW_ENTRY, "/project/app/counter.tsx");

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

function runHotUpdate(
    plugin: Plugin,
    environment: string,
    modules: HotUpdateModule[],
    clientFiles: string[],
): Array<{ type: string; event?: string }> {
    let hook = plugin.hotUpdate;
    if (typeof hook !== "function") throw new Error("expected a function hotUpdate hook");
    let invoke = hook as unknown as (
        this: HotUpdateContext,
        options: { modules: HotUpdateModule[]; server: unknown },
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
                    getModulesByFile(file: string) {
                        return clientFiles.includes(file) ? new Set([{}]) : undefined;
                    },
                },
            },
        },
    };

    invoke.call({ environment: { name: environment } }, { modules, server });
    return sent;
}

describe("serverDataHmr hotUpdate", () => {
    it("broadcasts a server-update when a server-only module changes", () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        let sent = runHotUpdate(plugin, "ssr", [{ file: "/project/app/document.tsx" }], []);

        expect(sent).toEqual([{ type: "custom", event: "pitlane:server-update" }]);
    });

    it("stays quiet when the changed module is also a client module", () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        let sent = runHotUpdate(
            plugin,
            "ssr",
            [{ file: "/project/app/counter.tsx" }],
            ["/project/app/counter.tsx"],
        );

        expect(sent).toEqual([]);
    });

    it("broadcasts when at least one changed module is server-only", () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        let sent = runHotUpdate(
            plugin,
            "ssr",
            [{ file: "/project/app/counter.tsx" }, { file: "/project/app/data.ts" }],
            ["/project/app/counter.tsx"],
        );

        expect(sent).toEqual([{ type: "custom", event: "pitlane:server-update" }]);
    });

    it("ignores updates outside the server environment", () => {
        let plugin = serverDataHmr(new Set(["ssr"]), "app/entry.browser");
        let sent = runHotUpdate(plugin, "client", [{ file: "/project/app/document.tsx" }], []);

        expect(sent).toEqual([]);
    });
});
