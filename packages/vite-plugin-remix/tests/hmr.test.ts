import type { Plugin } from "vite";

import { describe, expect, it, vi } from "vite-plus/test";

import { componentHmr, serverDataHmr } from "../src/hmr.ts";
import { clientEntryTransform } from "../src/transform.ts";

type TransformResult = { code: string; map?: unknown } | undefined | null | void;
type TransformHandler = (
    this: {
        environment: { name: string; config: { root: string } };
        warn: (message: string) => void;
    },
    code: string,
    id: string,
) => TransformResult | Promise<TransformResult>;

async function runTransform(
    plugin: Plugin,
    environment: string,
    code: string,
    id: string,
    root = "/project",
    warnings: string[] = [],
): Promise<TransformResult> {
    let hook = plugin.transform;
    if (!hook || typeof hook === "function") {
        throw new Error("expected an object-form transform hook with a filter");
    }
    let handler = hook.handler as TransformHandler;
    return await handler.call(
        {
            environment: { name: environment, config: { root } },
            warn: message => warnings.push(message),
        },
        code,
        id,
    );
}

// Narrows a transform result to its emitted code, failing the test when the
// hook unexpectedly skipped the module.
function codeOf(result: TransformResult): string {
    if (!result || typeof result !== "object" || typeof result.code !== "string") {
        throw new Error("expected a transform result with code");
    }
    return result.code;
}

const FUNCTION_ENTRY = `import { clientEntry } from "remix/component";
export const Counter = clientEntry(import.meta.url, function Counter(handle) {
    return () => null;
});
`;

const ARROW_ENTRY = `import { clientEntry } from "remix/component";
export const Counter = clientEntry(import.meta.url, handle => {
    return () => null;
});
`;

const FUNCTION_COMPONENT = `export function Card(handle) {
    return () => null;
}
`;

const ARROW_EXPR_ENTRY = `import { clientEntry } from "remix/component";
export const Counter = clientEntry(import.meta.url, (handle) => () => null);
`;

const ARROW_COMPONENT = `export const Card = (handle) => {
    return () => null;
};
`;

const NON_COMPONENT_ARROW = `export const NotAComponent = () => 42;
export const helper = (handle) => () => null;
`;

// Every shape `remix/component-hmr` matches on "PascalCase export that returns
// something" and then miscompiles. Instrumenting any of them breaks the
// module, so the plugin has to leave the whole file alone.
const UNSUPPORTED_EXPORTS: Record<string, string> = {
    "async function": `export async function Loader(props) {
    let data = await props.query;
    return <p>{data}</p>;
}
`,
    generator: `export function* Rows(props) {
    yield props.first;
    return props.rest;
}
`,
    "element-returning helper": `export function Card(props) {
    return <div>{props.children}</div>;
}
`,
    "element-returning function expression": `export const Card = function (props) {
    return <div>{props.children}</div>;
};
`,
    "async clientEntry setup": `import { clientEntry } from "remix/component";
export const Counter = clientEntry(import.meta.url, async function Counter(handle) {
    let start = await handle.props.start;
    return () => <b>{start}</b>;
});
`,
    "clientEntry setup returning no render function": `import { clientEntry } from "remix/component";
export const Counter = clientEntry(import.meta.url, function Counter(handle) {
    handle.ready = true;
});
`,
    "async function behind an export list": `async function Loader(props) {
    let data = await props.query;
    return <p>{data}</p>;
}
export { Loader };
`,
};

/** A real component sharing a module with one of the shapes above. */
const MIXED_MODULE = `export function Counter(handle) {
    let count = 0;
    return () => <b>{count}</b>;
}

export async function Loader(props) {
    let data = await props.query;
    return <p>{data}</p>;
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

        expect(code).toContain("remix/component-hmr/runtime/browser");
        expect(code).toContain("import.meta.hot.accept");
        expect(code).toContain("updateComponentModuleForHmr");
    });

    it("instruments components in a server environment through the server transform", async () => {
        let plugin = componentHmr(new Set(["ssr"]));
        let code = codeOf(
            await runTransform(plugin, "ssr", FUNCTION_COMPONENT, "/project/app/card.tsx"),
        );

        expect(code).toContain("remix/component-hmr/runtime/server");
        // The browser-only refresh runtime never leaks into the server output.
        expect(code).not.toContain("remix/component-hmr/runtime/browser");
    });

    it("hot-swaps arrow-form clientEntry islands by normalizing them to functions", async () => {
        let plugin = componentHmr(new Set(["ssr"]));
        let block = codeOf(await runTransform(plugin, "client", ARROW_ENTRY, "/project/app/a.tsx"));
        let expr = codeOf(
            await runTransform(plugin, "client", ARROW_EXPR_ENTRY, "/project/app/b.tsx"),
        );

        for (let code of [block, expr]) {
            expect(code).toContain("remix/component-hmr/runtime/browser");
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

    it.each(Object.entries(UNSUPPORTED_EXPORTS))(
        "leaves a module holding %s alone in both environments",
        async (_shape, code) => {
            let plugin = componentHmr(new Set(["ssr"]));

            expect(
                await runTransform(plugin, "client", code, "/project/app/x.tsx"),
            ).toBeUndefined();
            expect(await runTransform(plugin, "ssr", code, "/project/app/x.tsx")).toBeUndefined();
        },
    );

    it("warns when an unsupported export costs a real component its hot swap", async () => {
        let plugin = componentHmr(new Set(["ssr"]));
        let warnings: string[] = [];
        let result = await runTransform(
            plugin,
            "client",
            MIXED_MODULE,
            "/project/app/mixed.tsx",
            "/project",
            warnings,
        );

        expect(result).toBeUndefined();
        expect(warnings).toHaveLength(1);
        // Names both the export to move and what moving it buys back.
        expect(warnings[0]).toContain("Loader");
        expect(warnings[0]).toContain("Counter");
    });

    it("stays quiet when the module had no hot swap to lose", async () => {
        let plugin = componentHmr(new Set(["ssr"]));
        let warnings: string[] = [];
        await runTransform(
            plugin,
            "client",
            UNSUPPORTED_EXPORTS["element-returning helper"]!,
            "/project/app/card.tsx",
            "/project",
            warnings,
        );

        expect(warnings).toEqual([]);
    });

    it("instruments a component beside an aliased export component-hmr never matches", async () => {
        // `export { LoaderImpl as Loader }` is not a component export to
        // `component-hmr`, so nothing about the async function behind it is at risk
        // and Counter has to keep hot-swapping. Guards against over-skipping.
        let plugin = componentHmr(new Set(["ssr"]));
        let code = codeOf(
            await runTransform(
                plugin,
                "client",
                `async function LoaderImpl(props) {
    let data = await props.query;
    return <p>{data}</p>;
}
export { LoaderImpl as Loader };

export function Counter(handle) {
    let count = 0;
    return () => <b>{count}</b>;
}
`,
                "/project/app/aliased.tsx",
            ),
        );

        expect(code).toContain("import.meta.hot.accept");
        expect(code).toContain('"Counter"');
    });
});

describe("serverDataHmr", () => {
    it("is a dev-only plugin", () => {
        let plugin = serverDataHmr(new Set(["ssr"]));
        expect(plugin.name).toBe("pitlane-remix-server-data-hmr");
        expect(plugin.apply).toBe("serve");
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
        let plugin = serverDataHmr(new Set(["ssr"]));
        let sent = await runHotUpdate(plugin, "ssr", [{ file: "/project/app/document.tsx" }], {});

        expect(sent).toEqual([{ type: "custom", event: "server:update" }]);
    });

    it("stays quiet when the client graph serves the file as a script", async () => {
        let plugin = serverDataHmr(new Set(["ssr"]));
        let sent = await runHotUpdate(plugin, "ssr", [{ file: "/project/app/counter.tsx" }], {
            "/project/app/counter.tsx": [{ type: "js" }],
        });

        expect(sent).toEqual([]);
    });

    it("broadcasts when the client graph only holds a non-script node for the file", async () => {
        // Tailwind's content scanner registers `asset` nodes for ordinary server
        // files; treating those as client modules disables server-data HMR.
        let plugin = serverDataHmr(new Set(["ssr"]));
        let sent = await runHotUpdate(plugin, "ssr", [{ file: "/project/app/routes.tsx" }], {
            "/project/app/routes.tsx": [{ type: "asset" }],
        });

        expect(sent).toEqual([{ type: "custom", event: "server:update" }]);
    });

    it("broadcasts when the changed server file has no invalidated modules", async () => {
        let plugin = serverDataHmr(new Set(["ssr"]));
        let sent = await runHotUpdate(plugin, "ssr", [], {}, "/project/app/actions/projects.tsx");

        expect(sent).toEqual([{ type: "custom", event: "server:update" }]);
    });

    it("waits 50ms after the last server change before broadcasting", () => {
        let plugin = serverDataHmr(new Set(["ssr"]));
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

        vi.useFakeTimers();
        try {
            for (let file of ["/project/app/a.ts", "/project/app/b.ts", "/project/app/c.ts"]) {
                invoke.call(
                    { environment: { name: "ssr" } },
                    { file, modules: [{ file }], server },
                );
                vi.advanceTimersByTime(49);
                expect(sent).toEqual([]);
            }
            vi.advanceTimersByTime(1);
            expect(sent).toEqual([{ type: "custom", event: "server:update" }]);
        } finally {
            vi.useRealTimers();
        }
    });

    it("ignores updates outside the server environment", async () => {
        let plugin = serverDataHmr(new Set(["ssr"]));
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
        let plugin = serverDataHmr(new Set(["ssr"]));
        expect(await runHotUpdate(plugin, "ssr", [], {}, "/project/app/content.md")).toEqual([]);
    });

    it("broadcasts when there is no client environment to check against", async () => {
        let plugin = serverDataHmr(new Set(["ssr"]));
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
        expect(sent).toEqual([{ type: "custom", event: "server:update" }]);
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
            { environment: { name: env, config: { root: "/project" } }, warn: () => {} },
            code,
            id,
        );
    }

    it("keeps the portable clientEntry id after the component-hmr transform (client)", async () => {
        let id = "/project/app/counter.tsx";
        let instrumented = codeOf(
            await runTransform(componentHmr(new Set(["ssr"])), "client", FUNCTION_ENTRY, id),
        );
        let final = codeOf(await runClientEntry("client", instrumented, id));

        // The component-hmr accept boundary survives the second transform...
        expect(final).toContain("import.meta.hot.accept");
        expect(final).toContain("getCurrentComponentForHmr");
        // ...and the clientEntry identity rewrite is applied on top of it.
        expect(final).toContain('"file:app/counter.tsx#Counter"');
    });

    it("writes the same portable id on the server after the component-hmr transform", async () => {
        let id = "/project/app/counter.tsx";
        let instrumented = codeOf(
            await runTransform(componentHmr(new Set(["ssr"])), "ssr", FUNCTION_ENTRY, id),
        );
        let final = codeOf(await runClientEntry("ssr", instrumented, id));

        expect(final).toContain('"file:app/counter.tsx#Counter"');
        expect(final).not.toContain("?assets");
    });
});
