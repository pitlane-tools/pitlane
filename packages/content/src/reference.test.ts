import * as s from "remix/data-schema";
import { describe, expect, it } from "vitest";

import type { Reference } from "./types.ts";

import { createContent } from "./content.ts";
import { reference } from "./reference.ts";

describe("reference", () => {
    it("accepts a string id and outputs a reference object", () => {
        expect(s.parse(reference("authors"), "ada")).toEqual({
            collection: "authors",
            id: "ada",
        });
    });

    it("names the collection when handed something that is not an id", () => {
        let result = s.parseSafe(reference("authors"), 7);
        if (result.success) throw new Error("expected validation to fail");

        expect(result.issues.map(issue => issue.message)).toEqual([
            'Expected a reference id for collection "authors"',
        ]);
    });

    it("composes inside object, array, and optional like any other schema", () => {
        let schema = s.object({
            author: reference("authors"),
            tags: s.array(reference("tags")),
            editor: s.optional(reference("authors")),
        });

        expect(s.parse(schema, { author: "ada", tags: ["rust", "wasm"] })).toEqual({
            author: { collection: "authors", id: "ada" },
            tags: [
                { collection: "tags", id: "rust" },
                { collection: "tags", id: "wasm" },
            ],
            editor: undefined,
        });
    });

    it("types an entry's reference to the collection it names", async () => {
        let content = await createContent(c => ({
            blog: c.collection({
                loader: { name: "empty", load() {} },
                schema: s.object({ author: c.reference("authors") }),
            }),
            authors: c.collection({
                loader: { name: "empty", load() {} },
                schema: s.object({ name: s.string() }),
            }),
            tags: c.collection({
                loader: { name: "empty", load() {} },
                schema: s.object({ label: s.string() }),
            }),
        }));
        let author: Reference<"authors"> = { collection: "authors", id: "ada" };

        await content.authors.getEntry(author);
        // @ts-expect-error a reference into `authors` is not a `tags` id.
        await content.tags.getEntry(author);
    });

    it("does not verify that the target entry exists", async () => {
        let content = await createContent(c => ({
            blog: c.collection({
                loader: {
                    name: "memory",
                    async load(context) {
                        context.store.set({
                            id: "hello",
                            data: await context.parseData({
                                id: "hello",
                                data: { author: "nobody" },
                            }),
                        });
                    },
                },
                schema: s.object({ author: c.reference("authors") }),
            }),
            authors: c.collection({
                loader: { name: "empty", load() {} },
                schema: s.object({ name: s.string() }),
            }),
        }));

        let post = await content.blog.getEntry("hello");

        expect(post?.data.author).toEqual({ collection: "authors", id: "nobody" });
        expect(await content.authors.getEntry(post!.data.author)).toBeUndefined();
    });
});
