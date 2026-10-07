import type { Rolldown } from "vite";

import fc from "fast-check";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { clientEntryTransform } from "../src/transform.ts";

type TransformHandler = (
    this: { environment: { name: string; config: { root: string } } },
    code: string,
    id: string,
) => Rolldown.TransformResult | Promise<Rolldown.TransformResult>;

// Uppercase root segments: the generated lowercase segments can never walk
// back into the root, so every generated `../` survives in the key.
const ROOT = "/Checkout/Site/App";

let scratch: string;
let modules = 0;

beforeAll(async () => {
    // Inside the package, so the transformed modules resolve the real
    // `remix/component` this package depends on.
    scratch = await mkdtemp(fileURLToPath(new URL("./.tmp-identity-", import.meta.url)));
});

afterAll(async () => {
    await rm(scratch, { force: true, recursive: true });
});

/**
 * Transforms an island module as `environment` would, then evaluates it with
 * Remix's real `clientEntry()` and returns the identity the component carries,
 * which is what the server renderer reads.
 */
async function entryIdOf(
    environment: string,
    id: string,
    exportName: string,
): Promise<string | undefined> {
    let source = `import { clientEntry } from "remix/component";
export let ${exportName} = clientEntry(import.meta.url, function ${exportName}(handle) {
    return () => null;
});
`;
    let hook = clientEntryTransform(new Set(["ssr"])).transform;
    if (!hook || typeof hook === "function") throw new Error("expected an object-form hook");
    let result = await (hook.handler as TransformHandler).call(
        { environment: { name: environment, config: { root: ROOT } } },
        source,
        id,
    );
    if (!result || typeof result !== "object" || typeof result.code !== "string") {
        throw new Error(`no string transform for ${id}`);
    }

    let file = join(scratch, `island-${modules++}.mjs`);
    await writeFile(file, result.code);
    // Each generated module is a fresh file, so this must load it at run time.
    let mod = (await import(pathToFileURL(file).href)) as Record<string, { $entryId?: string }>;
    return mod[exportName]?.$entryId;
}

let segment = fc.stringMatching(/^[a-z][a-z0-9_-]{0,7}$/);
let moduleKey = fc
    .record({
        parents: fc.integer({ min: 0, max: 3 }),
        directories: fc.array(segment, { maxLength: 3 }),
        name: segment,
        extension: fc.constantFrom(".ts", ".tsx", ".js", ".jsx"),
    })
    .map(
        ({ parents, directories, name, extension }) =>
            "../".repeat(parents) + [...directories, name + extension].join("/"),
    );
let exportName = fc
    .stringMatching(/^[A-Z][A-Za-z0-9_]{0,10}$/)
    .filter(name => name !== "NaN" && name !== "Infinity");
let environment = fc.constantFrom("ssr", "client", "worker", "edge");

describe("proposal 0005: portable island identity", () => {
    it("gives every island the same root-relative file: identity in any two environments", async () => {
        await fc.assert(
            fc.asyncProperty(
                moduleKey,
                exportName,
                environment,
                environment,
                async (key, name, first, second) => {
                    let id = new URL(key, pathToFileURL(`${ROOT}/`)).pathname;
                    let expected = `file:${key}#${name}`;

                    expect(await entryIdOf(first, id, name)).toBe(expected);
                    expect(await entryIdOf(second, `${id}?v=1`, name)).toBe(expected);
                },
            ),
            { numRuns: 50 },
        );
    });
});
