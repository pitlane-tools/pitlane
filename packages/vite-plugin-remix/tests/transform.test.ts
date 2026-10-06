import type { Plugin } from "vite";

import { describe, expect, it } from "vite-plus/test";

import { clientEntryTransform } from "../src/transform.ts";

type TransformHook = Extract<NonNullable<Plugin["transform"]>, { handler: unknown }>;
type TransformOutput = Awaited<ReturnType<TransformHook["handler"]>>;

const ROOT = "/work/site";

/**
 * Runs the transform hook against a minimal fake plugin context. The handler
 * reads only the environment's name and root, so the hook's `this` is narrowed
 * structurally to that shape instead of booting a real plugin context.
 */
async function runTransform(
    environmentName: string,
    code: string,
    id = `${ROOT}/app/widgets.tsx`,
): Promise<TransformOutput> {
    let plugin = clientEntryTransform(new Set(["ssr"]));
    let hook = plugin.transform;
    if (!hook || typeof hook === "function") {
        throw new Error("expected an object-form transform hook with a filter");
    }
    let handler = hook.handler as (
        this: { environment: { name: string; config: { root: string } } },
        code: string,
        id: string,
    ) => TransformOutput | Promise<TransformOutput>;
    return await handler.call(
        { environment: { name: environmentName, config: { root: ROOT } } },
        code,
        id,
    );
}

const SINGLE = `import { clientEntry } from "remix/component";
export const Counter = clientEntry(import.meta.url, handle => {
    return () => null;
});
`;

const DOUBLE = `import { clientEntry } from "remix/component";
export const Counter = clientEntry(import.meta.url, handle => () => null);
export const Toggle = clientEntry(import.meta.url, handle => () => null);
`;

function codeOf(result: TransformOutput): string {
    if (result && typeof result === "object" && typeof result.code === "string") {
        return result.code;
    }
    throw new Error(`expected a { code } transform result, got ${JSON.stringify(result)}`);
}

describe("proposal 0005: portable island identity", () => {
    it.each(["ssr", "client", "worker"])(
        "writes the project-relative file: id with an export fragment in %s",
        async environment => {
            let code = codeOf(await runTransform(environment, SINGLE));

            expect(code).toContain(`clientEntry("file:app/widgets.tsx#Counter", handle`);
            expect(code).not.toContain("import.meta.url");
        },
    );

    it("writes byte-identical code in server and client environments", async () => {
        let server = codeOf(await runTransform("ssr", DOUBLE));
        let client = codeOf(await runTransform("client", DOUBLE));

        expect(client).toBe(server);
    });

    it("keys a linked module outside the root with leading ../ segments", async () => {
        let code = codeOf(await runTransform("ssr", SINGLE, "/work/packages/ui/src/counter.tsx"));

        expect(code).toContain(`clientEntry("file:../packages/ui/src/counter.tsx#Counter"`);
    });

    it("drops a module id's query from the key", async () => {
        let code = codeOf(await runTransform("ssr", SINGLE, `${ROOT}/app/widgets.tsx?v=1`));

        expect(code).toContain(`"file:app/widgets.tsx#Counter"`);
    });

    it("never introduces a virtual or query import", async () => {
        for (let environment of ["ssr", "client"]) {
            let code = codeOf(await runTransform(environment, DOUBLE));

            expect(code).not.toContain("?assets");
            expect(code.match(/^import /gm)).toHaveLength(1);
        }
    });

    it("never writes the checkout path into the module", async () => {
        let code = codeOf(await runTransform("ssr", DOUBLE));

        expect(code).not.toContain(ROOT);
    });

    it("rewrites every entry in a multi-entry file", async () => {
        let code = codeOf(await runTransform("ssr", DOUBLE));

        expect(code).toContain(`"file:app/widgets.tsx#Counter"`);
        expect(code).toContain(`"file:app/widgets.tsx#Toggle"`);
    });

    it("emits a sourcemap", async () => {
        let result = await runTransform("ssr", SINGLE);
        expect(result).toMatchObject({ map: { mappings: expect.any(String) } });
    });
});

describe("pattern strictness", () => {
    it("skips files without import.meta.url", async () => {
        let result = await runTransform("ssr", `export const x = clientEntry("/url", () => {});`);
        expect(result).toBeUndefined();
    });

    it("ignores non-exported clientEntry calls", async () => {
        let result = await runTransform(
            "ssr",
            `const Counter = clientEntry(import.meta.url, () => {});\nconsole.log(Counter);`,
        );
        expect(result).toBeUndefined();
    });

    it("ignores default exports", async () => {
        let result = await runTransform(
            "ssr",
            `export default clientEntry(import.meta.url, () => {});`,
        );
        expect(result).toBeUndefined();
    });

    it("ignores aliased callees", async () => {
        let result = await runTransform(
            "ssr",
            `import { clientEntry as ce } from "remix/component";
export const Counter = ce(import.meta.url, () => {});
// mention clientEntry so the filter would admit this file
`,
        );
        expect(result).toBeUndefined();
    });

    it("ignores calls with fewer than two arguments", async () => {
        let result = await runTransform(
            "ssr",
            `export const Counter = clientEntry(import.meta.url);`,
        );
        expect(result).toBeUndefined();
    });

    it.each(["let", "const", "var"])("matches an export declared with %s", async kind => {
        let result = await runTransform(
            "ssr",
            `export ${kind} Counter = clientEntry(import.meta.url, () => {});`,
        );
        expect(codeOf(result)).toContain(`"file:app/widgets.tsx#Counter"`);
    });

    it("leaves unrelated import.meta.url usage untouched", async () => {
        let result = await runTransform(
            "ssr",
            `export const here = import.meta.url;
export const Counter = clientEntry(import.meta.url, () => {});
`,
        );
        let code = codeOf(result);
        expect(code).toContain("export const here = import.meta.url;");
        expect(code).toContain(`"file:app/widgets.tsx#Counter"`);
    });
});
