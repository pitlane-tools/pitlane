import type { Plugin } from "vite";

import { describe, expect, it } from "vitest";

import { clientEntryTransform } from "../src/transform.ts";

type TransformHook = Extract<NonNullable<Plugin["transform"]>, { handler: unknown }>;
type TransformOutput = Awaited<ReturnType<TransformHook["handler"]>>;

/**
 * Runs the transform hook against a minimal fake plugin context. The handler
 * only reads `this.environment.name`, so we structurally narrow the hook's
 * `this` to exactly that shape instead of booting a real plugin context.
 */
async function runTransform(environmentName: string, code: string): Promise<TransformOutput> {
    let plugin = clientEntryTransform(new Set(["ssr"]));
    let hook = plugin.transform;
    if (!hook || typeof hook === "function") {
        throw new Error("expected an object-form transform hook with a filter");
    }
    let handler = hook.handler as (
        this: { environment: { name: string } },
        code: string,
        id: string,
    ) => TransformOutput | Promise<TransformOutput>;
    return await handler.call({ environment: { name: environmentName } }, code, "/app/widgets.tsx");
}

const SINGLE = `import { clientEntry } from "remix/ui";
export const Counter = clientEntry(import.meta.url, handle => {
    return () => null;
});
`;

const DOUBLE = `import { clientEntry } from "remix/ui";
export const Counter = clientEntry(import.meta.url, handle => () => null);
export const Toggle = clientEntry(import.meta.url, handle => () => null);
`;

function codeOf(result: TransformOutput): string {
    if (result && typeof result === "object" && typeof result.code === "string") {
        return result.code;
    }
    throw new Error(`expected a { code } transform result, got ${JSON.stringify(result)}`);
}

describe("server environment", () => {
    it("rewrites import.meta.url to the resolved client entry with an export fragment", async () => {
        let result = await runTransform("ssr", SINGLE);
        let code = codeOf(result);

        expect(code).toContain(
            `import ___clientEntryAssets from "/app/widgets.tsx?assets=client";`,
        );
        expect(code).toContain(`clientEntry(___clientEntryAssets.entry + "#Counter", handle`);
        expect(code).not.toContain("clientEntry(import.meta.url");
    });

    it("shares one assets import across multiple entries in a file", async () => {
        let result = await runTransform("ssr", DOUBLE);
        let code = codeOf(result);

        let prepends = code.match(/import ___clientEntryAssets/g);
        expect(prepends).toHaveLength(1);
        expect(code).toContain(`___clientEntryAssets.entry + "#Counter"`);
        expect(code).toContain(`___clientEntryAssets.entry + "#Toggle"`);
    });

    it("emits a sourcemap", async () => {
        let result = await runTransform("ssr", SINGLE);
        expect(result).toMatchObject({ map: { mappings: expect.any(String) } });
    });
});

describe("client environment", () => {
    it("appends the export fragment to import.meta.url without an assets import", async () => {
        let result = await runTransform("client", SINGLE);
        let code = codeOf(result);

        expect(code).toContain(`clientEntry(import.meta.url + "#Counter", handle`);
        expect(code).not.toContain("___clientEntryAssets");
    });

    it("rewrites every entry in a multi-entry file", async () => {
        let result = await runTransform("client", DOUBLE);
        let code = codeOf(result);

        expect(code).toContain(`import.meta.url + "#Counter"`);
        expect(code).toContain(`import.meta.url + "#Toggle"`);
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
            `import { clientEntry as ce } from "remix/ui";
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

    it("leaves unrelated import.meta.url usage untouched", async () => {
        let result = await runTransform(
            "ssr",
            `export const here = import.meta.url;
export const Counter = clientEntry(import.meta.url, () => {});
`,
        );
        let code = codeOf(result);
        expect(code).toContain("export const here = import.meta.url;");
        expect(code).toContain(`___clientEntryAssets.entry + "#Counter"`);
    });
});
