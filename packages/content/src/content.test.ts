import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";
import { describe, expect, it, vi } from "vitest";

import type { ContentLoader, LiveEntry, LiveLoader, LoadedEntry, Reference } from "./types.ts";

import { createContent } from "./content.ts";
import { prebuiltManifest } from "./prebuild.ts";
import { PREBUILT_MANIFEST } from "./symbols.ts";

/** A `ContentLoader` over entries held in memory, so a test never touches disk. */
function memoryLoader(entries: LoadedEntry[], name = "memory"): ContentLoader {
    return {
        name,
        async load(context) {
            for (let entry of entries) {
                context.store.set({
                    ...entry,
                    data: await context.parseData({
                        id: entry.id,
                        data: entry.data,
                        filePath: entry.filePath,
                    }),
                });
            }
        },
    };
}

function liveLoader(entries: LiveEntry<Record<string, unknown>>[]): LiveLoader {
    return {
        name: "live",
        async loadCollection() {
            return entries;
        },
        async loadEntry(id) {
            return entries.find(entry => entry.id === id);
        },
    };
}

let title = s.object({ title: s.string() });

/** The error a read rejected with, so a test can assert on its message. */
async function failure(work: Promise<unknown>) {
    let caught: unknown;
    await work.catch((error: unknown) => {
        caught = error;
    });
    return caught as Error;
}

describe("createContent", () => {
    it("returns one collection per key in the builder's return value", async () => {
        let content = await createContent(c => ({
            blog: c.collection({ loader: memoryLoader([]), schema: title }),
            authors: c.collection({ loader: memoryLoader([]), schema: title }),
        }));

        expect(Object.keys(content)).toEqual(["blog", "authors"]);
        expect(typeof content.blog.getCollection).toBe("function");
        expect(typeof content.blog.getEntry).toBe("function");
    });

    it("performs no I/O, so a loader is untouched until something is read", async () => {
        let load = vi.fn();

        await createContent(c => ({
            blog: c.collection({ loader: { name: "spy", load }, schema: title }),
        }));

        expect(load).not.toHaveBeenCalled();
    });

    it("throws when a reference names a collection the builder did not return", async () => {
        await expect(
            createContent(c => ({
                blog: c.collection({
                    loader: memoryLoader([]),
                    schema: s.object({ author: c.reference("writers") }),
                }),
                authors: c.collection({ loader: memoryLoader([]), schema: title }),
            })),
        ).rejects.toThrow(
            'Unknown collection "writers" referenced by createContent; known collections are blog, authors.',
        );
    });
});

describe("the manifest handshake", () => {
    it("registers under the symbol the runtime reads", async () => {
        // `manifest.ts` spells the symbol literally, because anything it
        // imports is hoisted into the chunk `content()` replaces. This is what
        // keeps that literal and `symbols.ts` from drifting apart: importing
        // the package has to leave the key `prebuiltManifest()` reads present.
        await import("./manifest.ts");

        expect(Object.getOwnPropertySymbols(globalThis)).toContain(PREBUILT_MANIFEST);
        expect(prebuiltManifest()).toBeNull();
    });
});

describe("a ContentLoader collection", () => {
    it("runs its loader on the first read and memoizes the result", async () => {
        let load = vi.fn(memoryLoader([{ id: "a", data: { title: "A" } }]).load);
        let content = await createContent(c => ({
            blog: c.collection({ loader: { name: "spy", load }, schema: title }),
        }));

        await content.blog.getCollection();
        await content.blog.getEntry("a");
        await content.blog.getCollection();

        expect(load).toHaveBeenCalledTimes(1);
    });

    it("shares one in-flight load between concurrent readers", async () => {
        // Hold the load open until all three reads are in flight, so the
        // assertion is about deduplication rather than about timing.
        let inFlight = Promise.withResolvers<void>();
        let load = vi.fn(() => inFlight.promise);
        let content = await createContent(c => ({
            blog: c.collection({ loader: { name: "spy", load }, schema: title }),
        }));

        let reads = Promise.all([
            content.blog.getCollection(),
            content.blog.getCollection(),
            content.blog.getEntry("a"),
        ]);
        inFlight.resolve();
        await reads;

        expect(load).toHaveBeenCalledTimes(1);
    });

    it("rejects the read that triggered a failing load, naming the collection", async () => {
        let content = await createContent(c => ({
            blog: c.collection({
                loader: {
                    name: "broken",
                    load() {
                        throw new Error("the network went away");
                    },
                },
                schema: title,
            }),
        }));

        await expect(content.blog.getCollection()).rejects.toThrow(
            /collection "blog".*the network went away/s,
        );
    });

    it("does not memoize a failure, so the next read retries", async () => {
        let attempts = 0;
        let content = await createContent(c => ({
            blog: c.collection({
                loader: {
                    name: "flaky",
                    async load(context) {
                        attempts += 1;
                        if (attempts === 1) throw new Error("timed out");
                        context.store.set({
                            id: "a",
                            data: await context.parseData({ id: "a", data: { title: "A" } }),
                        });
                    },
                },
                schema: title,
            }),
        }));

        await expect(content.blog.getCollection()).rejects.toThrow("timed out");
        let entries = await content.blog.getCollection();

        expect(entries.map(entry => entry.id)).toEqual(["a"]);
        expect(attempts).toBe(2);
    });

    it("never exposes a half-populated collection", async () => {
        let content = await createContent(c => ({
            blog: c.collection({
                loader: {
                    name: "half",
                    async load(context) {
                        context.store.set({
                            id: "a",
                            data: await context.parseData({ id: "a", data: { title: "A" } }),
                        });
                        throw new Error("stopped halfway");
                    },
                },
                schema: title,
            }),
        }));

        await expect(content.blog.getCollection()).rejects.toThrow("stopped halfway");
        await expect(content.blog.getCollection()).rejects.toThrow("stopped halfway");
    });
});

describe("a LiveLoader collection", () => {
    it("asks its loader on every read rather than memoizing", async () => {
        let entries: LiveEntry<Record<string, unknown>>[] = [{ id: "a", data: { title: "A" } }];
        let loadCollection = vi.fn(async () => entries);
        let loadEntry = vi.fn(async (id: string) => entries.find(entry => entry.id === id));
        let content = await createContent(c => ({
            blog: c.collection({
                loader: { name: "live", loadCollection, loadEntry },
                schema: title,
            }),
        }));

        await content.blog.getCollection();
        await content.blog.getCollection();
        await content.blog.getEntry("a");
        await content.blog.getEntry("a");

        expect(loadCollection).toHaveBeenCalledTimes(2);
        expect(loadEntry).toHaveBeenCalledTimes(2);
    });

    it("sees data published after the first read", async () => {
        let entries: LiveEntry<Record<string, unknown>>[] = [{ id: "a", data: { title: "A" } }];
        let content = await createContent(c => ({
            blog: c.collection({ loader: liveLoader(entries), schema: title }),
        }));

        expect(await content.blog.getCollection()).toHaveLength(1);
        entries.push({ id: "b", data: { title: "B" } });

        expect(await content.blog.getCollection()).toHaveLength(2);
    });

    it("validates every entry it returns, on every read", async () => {
        let content = await createContent(c => ({
            blog: c.collection({
                loader: liveLoader([{ id: "a", data: { title: 7 } }]),
                schema: title,
            }),
        }));

        await expect(content.blog.getCollection()).rejects.toThrow(/collection "blog"/);
        await expect(content.blog.getEntry("a")).rejects.toThrow(/collection "blog"/);
    });

    it("resolves to undefined for an id its loader does not know", async () => {
        let content = await createContent(c => ({
            blog: c.collection({ loader: liveLoader([]), schema: title }),
        }));

        expect(await content.blog.getEntry("missing")).toBeUndefined();
    });
});

describe("reading a collection", () => {
    let posts = [
        { id: "c", data: { title: "C" } },
        { id: "a", data: { title: "A" } },
        { id: "b", data: { title: "B" } },
    ];

    async function blog() {
        return await createContent(c => ({
            blog: c.collection({ loader: memoryLoader(posts), schema: title }),
        }));
    }

    it("returns every entry sorted by id, ascending", async () => {
        let content = await blog();

        expect((await content.blog.getCollection()).map(entry => entry.id)).toEqual([
            "a",
            "b",
            "c",
        ]);
    });

    it("keeps that order when a filter is applied", async () => {
        let content = await blog();
        let entries = await content.blog.getCollection(entry => entry.id !== "b");

        expect(entries.map(entry => entry.id)).toEqual(["a", "c"]);
    });

    it("carries the id, the collection name, and the parsed data on each entry", async () => {
        let content = await createContent(c => ({
            blog: c.collection({
                loader: memoryLoader([
                    { id: "hello", data: { title: "Hello" }, filePath: "app/content/hello.md" },
                ]),
                schema: title,
            }),
        }));
        let entry = await content.blog.getEntry("hello");

        expect(entry).toMatchObject({
            id: "hello",
            collection: "blog",
            data: { title: "Hello" },
            filePath: "app/content/hello.md",
        });
    });

    it("resolves to undefined for an unknown id", async () => {
        let content = await blog();

        expect(await content.blog.getEntry("nope")).toBeUndefined();
    });

    it("accepts a reference object, reading only its id", async () => {
        let content = await blog();
        // The receiver already fixes the collection, so the field is not read.
        // Typed as a foreign reference on purpose: only a cast can get one here,
        // which is what the type parameter is for.
        let foreign = { collection: "elsewhere", id: "a" } as unknown as Reference<"blog">;

        expect((await content.blog.getEntry(foreign))?.id).toBe("a");
    });
});

describe("schema validation", () => {
    it("parses frontmatter into the schema's output type", async () => {
        let content = await createContent(c => ({
            blog: c.collection({
                loader: memoryLoader([{ id: "a", data: { publishedOn: "2026-09-17" } }]),
                schema: s.object({ publishedOn: coerce.date() }),
            }),
        }));
        let entry = await content.blog.getEntry("a");

        expect(entry?.data.publishedOn).toBeInstanceOf(Date);
        expect(entry?.data.publishedOn.getUTCFullYear()).toBe(2026);
    });

    it("names the collection, the entry, the file, and every issue when it fails", async () => {
        let content = await createContent(c => ({
            blog: c.collection({
                loader: memoryLoader([
                    { id: "broken", data: { title: 7 }, filePath: "app/content/broken.md" },
                ]),
                schema: s.object({ title: s.string(), summary: s.string() }),
            }),
        }));

        let error = await failure(content.blog.getCollection());

        expect(error.message.split("\n")[0]).toBe(
            'Failed to parse entry "broken" in collection "blog" (app/content/broken.md):',
        );
        expect(error.message).toMatch(/^ {2}- title: /m);
        expect(error.message).toMatch(/^ {2}- summary: /m);
    });

    it("omits the file path from the message when an entry has none", async () => {
        let content = await createContent(c => ({
            blog: c.collection({
                loader: memoryLoader([{ id: "broken", data: { title: 7 } }]),
                schema: title,
            }),
        }));

        let error = await failure(content.blog.getCollection());

        expect(error.message.split("\n")[0]).toBe(
            'Failed to parse entry "broken" in collection "blog":',
        );
    });

    it("rejects a second entry with an id the collection already has", async () => {
        let content = await createContent(c => ({
            blog: c.collection({
                loader: {
                    name: "duplicating",
                    async load(context) {
                        for (let index of [0, 1]) {
                            context.store.set({
                                id: "same",
                                data: await context.parseData({
                                    id: "same",
                                    data: { title: `${index}` },
                                }),
                            });
                        }
                    },
                },
                schema: title,
            }),
        }));

        await expect(content.blog.getCollection()).rejects.toThrow(
            'Duplicate entry id "same" in collection "blog".',
        );
    });
});
