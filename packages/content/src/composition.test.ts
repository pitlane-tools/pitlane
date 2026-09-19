import { init, parse } from "es-module-lexer";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { missingRenderer } from "./parse.ts";

/**
 * Every bare specifier statically reachable from one entry module.
 *
 * Static and value-level only, which is what a consumer has to install.
 * A dynamic `import()` is how this package reaches an optional dependency, so
 * counting one would defeat the thing being measured. An `import type` is
 * erased before anything runs, so counting one would measure the type graph
 * rather than the module graph.
 */
async function staticDependencies(entry: string): Promise<Set<string>> {
    await init;

    let bare = new Set<string>();
    let seen = new Set<string>();
    let queue = [path.resolve(import.meta.dirname, entry)];

    while (queue.length > 0) {
        let file = queue.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);

        let source = await fs.readFile(file, "utf8");
        let [imports] = parse(source);
        for (let record of imports) {
            // `d` is -1 for a static import, -2 for `import.meta`, and the
            // statement's offset for a dynamic one.
            if (record.d !== -1 || record.n === undefined) continue;
            if (/^(?:im|ex)port\s+type\b/.test(source.slice(record.ss, record.se))) continue;
            if (record.n.startsWith(".")) {
                queue.push(path.resolve(path.dirname(file), record.n));
                continue;
            }
            bare.add(record.n);
        }
    }

    return bare;
}

/** `remix/ui` and `remix/data-schema` both count; `remixed-colors` would not. */
function packagesOf(specifiers: Set<string>): Set<string> {
    return new Set(
        [...specifiers].map(specifier => {
            let parts = specifier.split("/");
            return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
        }),
    );
}

describe("what a consumer has to install", () => {
    it("reads and validates content without Remix", async () => {
        let packages = packagesOf(await staticDependencies("./index.ts"));

        expect([...packages]).not.toContain("remix");
    });

    it("loads the built-in loaders without Remix", async () => {
        let packages = packagesOf(await staticDependencies("./loaders.ts"));

        expect([...packages]).not.toContain("remix");
    });

    it("keeps the query path free of the bundler and the renderer", async () => {
        let packages = packagesOf(await staticDependencies("./index.ts"));

        expect([...packages]).not.toContain("vite");
        expect([...packages]).not.toContain("satteri");
    });

    it("has a data path that needs nothing at all", async () => {
        // Not a count of a number somebody can raise without noticing: the
        // list is empty, so the first static dependency added to the query
        // path fails here and gets explained.
        let packages = packagesOf(await staticDependencies("./index.ts"));

        expect([...packages].filter(name => !name.startsWith("node:"))).toEqual([]);
    });
});

describe("the internals another bundler's plugin reuses", () => {
    for (let entry of ["./prebuild.ts", "./codegen.ts", "./mdx.ts"]) {
        it(`keeps ${entry.slice(2)} neutral`, async () => {
            let packages = packagesOf(await staticDependencies(entry));

            expect([...packages]).not.toContain("remix");
            expect([...packages]).not.toContain("vite");
            expect([...packages]).not.toContain("satteri");
        });
    }
});

describe("rendering without the renderer installed", () => {
    /** What Node throws when `render()` reaches for a Remix that is not there. */
    function moduleNotFound(specifier: string) {
        let error = new Error(
            `Cannot find package '${specifier}' imported from /app/dist/index.mjs`,
        );
        return Object.assign(error, { code: "ERR_MODULE_NOT_FOUND" });
    }

    it("names Remix and the entry instead of a resolver path", () => {
        let error = missingRenderer("blog/hello", moduleNotFound("remix"));

        expect(error?.message).toContain("blog/hello");
        expect(error?.message).toContain("remix");
        expect(error?.cause).toBeDefined();
    });

    it("leaves a failure that is not the missing framework alone", () => {
        expect(missingRenderer("blog/hello", moduleNotFound("satteri"))).toBeUndefined();
        expect(missingRenderer("blog/hello", new TypeError("boom"))).toBeUndefined();
    });
});
