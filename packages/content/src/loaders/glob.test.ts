import { fileURLToPath } from "node:url";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";
import { describe, expect, it, vi } from "vitest";

import type { ContentLoader, LoadedEntry, StandardSchemaV1 } from "../types.ts";

import { createContent } from "../content.ts";
import { glob } from "./glob.ts";

/** Accepts whatever the loader read, so a loader test is not a schema test. */
let passthrough: StandardSchemaV1<Record<string, unknown>> = {
    "~standard": {
        version: 1,
        vendor: "pitlane-content-test",
        validate: value => ({ value: value as Record<string, unknown> }),
    },
};

let fixtures = fileURLToPath(new URL("../fixtures", import.meta.url));

/**
 * Runs a loader against its own `LoaderContext` — the interface `createContent`
 * calls it through — and returns the entries it stored, in the order it stored
 * them. `parseData` passes the data through so a loader test is about reading
 * files rather than about schemas.
 */
async function collect(loader: ContentLoader, collection = "blog") {
    let stored: LoadedEntry[] = [];
    await loader.load({
        collection,
        root: process.cwd(),
        async parseData({ data }) {
            return data as never;
        },
        store: {
            set(entry) {
                stored.push(entry);
            },
        },
    });
    return stored;
}

describe("loaders.glob", () => {
    it("reads Markdown frontmatter as data and the remaining text as the body", async () => {
        let [entry] = await collect(glob({ pattern: "hello.md", base: `${fixtures}/blog` }));

        expect(entry!.data).toEqual({
            title: "Hello",
            summary: "The first post",
            publishedOn: "2026-01-02",
            author: "ada",
        });
        expect(entry!.body?.source).toContain("# Greeting");
        expect(entry!.body?.source).not.toContain("title: Hello");
    });

    it("records the body format as the file's suffix", async () => {
        let entries = await collect(glob({ pattern: "**/*.{md,mdx}", base: `${fixtures}/blog` }));

        expect(entries.map(entry => entry.body?.format)).toEqual(["md", "mdx"]);
    });

    it("derives an id from the path relative to base, with the extension stripped", async () => {
        let entries = await collect(glob({ pattern: "**/*.{md,mdx}", base: `${fixtures}/blog` }));

        expect(entries.map(entry => entry.id)).toEqual(["hello", "nested/second"]);
    });

    it("reports the file path of every entry it produced", async () => {
        let [entry] = await collect(glob({ pattern: "hello.md", base: `${fixtures}/blog` }));

        expect(entry!.filePath).toBe(`${fixtures}/blog/hello.md`);
    });

    it("takes a computed pattern, because nothing about it is read statically", async () => {
        let extension = ["m", "d"].join("");
        let entries = await collect(
            glob({ pattern: `hello.${extension}`, base: `${fixtures}/blog` }),
        );

        expect(entries.map(entry => entry.id)).toEqual(["hello"]);
    });

    it("accepts an array of patterns", async () => {
        let entries = await collect(
            glob({ pattern: ["hello.md", "nested/second.mdx"], base: `${fixtures}/blog` }),
        );

        expect(entries.map(entry => entry.id)).toEqual(["hello", "nested/second"]);
    });

    it("hands generateId the entry's frontmatter, so an id can come from it", async () => {
        let entries = await collect(
            glob({
                pattern: "hello.md",
                base: `${fixtures}/blog`,
                generateId: ({ data }) => `by-${String(data.author)}`,
            }),
        );

        expect(entries.map(entry => entry.id)).toEqual(["by-ada"]);
    });

    it("lets generateId replace the derivation entirely", async () => {
        let entries = await collect(
            glob({
                pattern: "**/*.{md,mdx}",
                base: `${fixtures}/blog`,
                generateId: ({ entry }) => entry.toUpperCase(),
            }),
        );

        expect(entries.map(entry => entry.id)).toEqual(["HELLO.MD", "NESTED/SECOND.MDX"]);
    });

    it("parses .json, .yaml, and .yml entries as data carrying no body", async () => {
        let entries = await collect(
            glob({ pattern: "*.{json,yaml,yml}", base: `${fixtures}/data` }),
        );

        expect(entries.map(entry => entry.data)).toEqual([{ title: "One" }, { title: "Two" }]);
        expect(entries.every(entry => entry.body === undefined)).toBe(true);
    });

    it("skips a file whose extension it has no parser for", async () => {
        let entries = await collect(glob({ pattern: "*", base: fixtures }));

        expect(entries.map(entry => entry.id)).toEqual([
            "authors",
            "authors-keyed",
            "authors-unidentified",
            "settings",
        ]);
    });

    it("normalises the path separator in the id it derives", async () => {
        let [entry] = await collect(glob({ pattern: "**/*.mdx", base: `${fixtures}/blog` }));

        expect(entry!.id).toBe("nested/second");
    });

    it("resolves base against the project root and defaults it to the root itself", async () => {
        let entries = await collect(glob({ pattern: "src/fixtures/data/*.yml" }));

        expect(entries.map(entry => entry.id)).toEqual(["src/fixtures/data/one"]);
    });

    it("builds where there is no process, because the factory runs at module scope", () => {
        let built: ContentLoader | undefined;
        let thrown: unknown;

        vi.stubGlobal("process", undefined);
        try {
            built = glob({ pattern: "**/*.md", base: "app/content/blog" });
        } catch (error) {
            thrown = error;
        } finally {
            vi.unstubAllGlobals();
        }

        expect(thrown).toBeUndefined();
        expect(built?.watchedPaths?.()).toEqual([]);
    });

    it("reports nothing to watch until a load has told it where the root is", () => {
        let loader = glob({ pattern: "**/*.md", base: "app/content/blog" });

        expect(loader.watchedPaths?.()).toEqual([]);
    });

    it("reports the directories it read so the plugin can watch them", async () => {
        let loader = glob({ pattern: "**/*.md", base: `${fixtures}/blog` });
        await collect(loader);

        expect(loader.watchedPaths?.()).toEqual([`${fixtures}/blog`]);
    });

    it("watches the pattern's own directory rather than the whole of base", async () => {
        let loader = glob({ pattern: "src/fixtures/blog/**/*.md" });
        await collect(loader);

        expect(loader.watchedPaths?.()).toEqual([`${fixtures}/blog`]);
    });

    it("unions the directories of an array of patterns", async () => {
        let loader = glob({ pattern: ["src/fixtures/blog/**/*.md", "src/fixtures/data/*.yml"] });
        await collect(loader);

        expect(loader.watchedPaths?.()).toEqual([`${fixtures}/blog`, `${fixtures}/data`]);
    });

    it("watches the containing directory of a pattern that names one file", async () => {
        let loader = glob({ pattern: "nested/second.mdx", base: `${fixtures}/blog` });
        await collect(loader);

        expect(loader.watchedPaths?.()).toEqual([`${fixtures}/blog/nested`]);
    });
});

describe("loaders.glob parse failures", () => {
    it("names the file whose frontmatter will not parse", async () => {
        let loader = glob({ pattern: "bad-frontmatter.md", base: `${fixtures}/broken` });

        await expect(collect(loader)).rejects.toThrow(
            new RegExp(`Failed to parse "${fixtures}/broken/bad-frontmatter\\.md"`),
        );
    });

    it("names the file whose JSON will not parse", async () => {
        let loader = glob({ pattern: "bad.json", base: `${fixtures}/broken` });

        await expect(collect(loader)).rejects.toThrow(
            new RegExp(`Failed to parse "${fixtures}/broken/bad\\.json"`),
        );
    });
});

describe("loaders.glob options.satteri", () => {
    it("forwards the configured plugins to the runtime renderer", async () => {
        let seen: string[] = [];
        let loader = glob({
            pattern: "hello.md",
            base: `${fixtures}/blog`,
            satteri: {
                mdastPlugins: [
                    {
                        name: "spy",
                        heading(node, context) {
                            seen.push(context.textContent(node));
                        },
                    },
                ],
            },
        });
        let content = await createContent(c => ({
            blog: c.collection({ loader, schema: passthrough }),
        }));
        let entry = await content.blog.getEntry("hello");
        await entry!.render();

        expect(seen).toEqual(["Greeting"]);
    });
});

describe("loaders.glob validation", () => {
    it("validates each entry through the collection's schema", async () => {
        let parsed: unknown[] = [];
        let schema = s.object({
            title: s.string(),
            summary: s.string(),
            publishedOn: coerce.date(),
            author: s.string(),
        });
        await glob({ pattern: "hello.md", base: `${fixtures}/blog` }).load({
            collection: "blog",
            root: process.cwd(),
            async parseData({ data }) {
                parsed.push(data);
                return s.parse(schema, data) as never;
            },
            store: { set() {} },
        });

        expect(parsed).toEqual([
            {
                title: "Hello",
                summary: "The first post",
                publishedOn: "2026-01-02",
                author: "ada",
            },
        ]);
    });
});
