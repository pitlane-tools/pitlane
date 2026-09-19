import * as path from "node:path";
import * as s from "remix/data-schema";
import { describe, expect, it } from "vitest";

import type { BrowserHmrChannel, FileEvent } from "./hot.ts";
import type { ContentLoader, LoadedEntry } from "./types.ts";

import { createContent } from "./content.ts";
import { watchCollections } from "./hot.ts";

/**
 * A loader whose entries can be rewritten between loads, so a test can change
 * the content under a populated collection the way an author changes a file.
 */
function editableLoader(entries: LoadedEntry[], name = "editable") {
    let current = entries;
    let loads = 0;
    return {
        loader: {
            name,
            async load(context) {
                loads += 1;
                for (let entry of current) {
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
        } satisfies ContentLoader,
        edit(next: LoadedEntry[]) {
            current = next;
        },
        get loads() {
            return loads;
        },
    };
}

/** Stands in for the channel `remix/node-hmr` hands a supervised process. */
function fakeChannel() {
    let watched = new Set<string>();
    let handlers: ((events: readonly FileEvent[]) => Promise<readonly unknown[]>)[] = [];
    let closed = false;
    return {
        channel: {
            url: "http://127.0.0.1:0/hmr",
            close() {
                closed = true;
            },
            onFileEvents(handler) {
                handlers.push(handler);
                return () => {
                    handlers = handlers.filter(each => each !== handler);
                };
            },
            updateWatchedFiles({ add, remove }) {
                for (let file of remove) watched.delete(file);
                for (let file of add) watched.add(file);
            },
        } satisfies BrowserHmrChannel,
        get watched() {
            return [...watched].sort();
        },
        get closed() {
            return closed;
        },
        async report(...events: FileEvent[]) {
            let emitted = [];
            for (let handler of handlers) emitted.push(...(await handler(events)));
            return emitted;
        },
    };
}

let post = s.object({ title: s.string() });

describe("watchCollections", () => {
    it("watches nothing until a collection is read", async () => {
        let blog = editableLoader([
            { id: "one", data: { title: "One" }, filePath: "content/one.md" },
        ]);
        let content = await createContent(c => ({
            blog: c.collection({ loader: blog.loader, schema: post }),
        }));
        let hmr = fakeChannel();

        await watchCollections(content, hmr.channel, "/project");

        // Registering here would register an empty set: nothing has loaded.
        expect(hmr.watched).toEqual([]);

        await content.blog.getCollection();
        expect(hmr.watched).toEqual([path.join("/project", "content/one.md")]);
    });

    it("reloads the collection a changed file belongs to", async () => {
        let blog = editableLoader([
            { id: "one", data: { title: "One" }, filePath: "content/one.md" },
        ]);
        let content = await createContent(c => ({
            blog: c.collection({ loader: blog.loader, schema: post }),
        }));
        let hmr = fakeChannel();
        await watchCollections(content, hmr.channel, "/project");
        await content.blog.getCollection();

        blog.edit([{ id: "one", data: { title: "Edited" }, filePath: "content/one.md" }]);
        let emitted = await hmr.report({
            event: "change",
            filePath: path.join("/project", "content/one.md"),
        });

        expect(emitted).toEqual([{ type: "reload" }]);
        let [entry] = await content.blog.getCollection();
        expect(entry?.data).toEqual({ title: "Edited" });
        expect(blog.loads).toBe(2);
    });

    it("leaves a collection the change did not touch populated", async () => {
        let blog = editableLoader(
            [{ id: "one", data: { title: "One" }, filePath: "content/blog/one.md" }],
            "blog",
        );
        let notes = editableLoader(
            [{ id: "two", data: { title: "Two" }, filePath: "content/notes/two.md" }],
            "notes",
        );
        let content = await createContent(c => ({
            blog: c.collection({ loader: blog.loader, schema: post }),
            notes: c.collection({ loader: notes.loader, schema: post }),
        }));
        let hmr = fakeChannel();
        await watchCollections(content, hmr.channel, "/project");
        await content.blog.getCollection();
        await content.notes.getCollection();

        await hmr.report({
            event: "change",
            filePath: path.join("/project", "content/blog/one.md"),
        });
        await content.blog.getCollection();
        await content.notes.getCollection();

        expect(blog.loads).toBe(2);
        expect(notes.loads).toBe(1);
    });

    it("drops a deleted file from the watch set on the next load", async () => {
        let blog = editableLoader([
            { id: "one", data: { title: "One" }, filePath: "content/one.md" },
            { id: "two", data: { title: "Two" }, filePath: "content/two.md" },
        ]);
        let content = await createContent(c => ({
            blog: c.collection({ loader: blog.loader, schema: post }),
        }));
        let hmr = fakeChannel();
        await watchCollections(content, hmr.channel, "/project");
        await content.blog.getCollection();

        blog.edit([{ id: "one", data: { title: "One" }, filePath: "content/one.md" }]);
        await hmr.report({
            event: "unlink",
            filePath: path.join("/project", "content/two.md"),
        });
        await content.blog.getCollection();

        expect(hmr.watched).toEqual([path.join("/project", "content/one.md")]);
    });

    it("surfaces a broken reload at the next read, not at the watcher", async () => {
        let blog = editableLoader([
            { id: "one", data: { title: "One" }, filePath: "content/one.md" },
        ]);
        let content = await createContent(c => ({
            blog: c.collection({ loader: blog.loader, schema: post }),
        }));
        let hmr = fakeChannel();
        await watchCollections(content, hmr.channel, "/project");
        await content.blog.getCollection();

        blog.edit([{ id: "one", data: { title: 42 }, filePath: "content/one.md" }]);
        let emitted = await hmr.report({
            event: "change",
            filePath: path.join("/project", "content/one.md"),
        });

        expect(emitted).toEqual([{ type: "reload" }]);
        await expect(content.blog.getCollection()).rejects.toThrow(/one\.md/);

        // A failed load is not memoized, so the fix takes effect without a restart.
        blog.edit([{ id: "one", data: { title: "Fixed" }, filePath: "content/one.md" }]);
        let [entry] = await content.blog.getCollection();
        expect(entry?.data).toEqual({ title: "Fixed" });
    });

    it("ignores an event for a file no collection loaded", async () => {
        let blog = editableLoader([
            { id: "one", data: { title: "One" }, filePath: "content/one.md" },
        ]);
        let content = await createContent(c => ({
            blog: c.collection({ loader: blog.loader, schema: post }),
        }));
        let hmr = fakeChannel();
        await watchCollections(content, hmr.channel, "/project");
        await content.blog.getCollection();

        let emitted = await hmr.report({
            event: "change",
            filePath: path.join("/project", "app/server.ts"),
        });
        await content.blog.getCollection();

        expect(emitted).toEqual([]);
        expect(blog.loads).toBe(1);
    });

    it("watches an entry without a file path by not watching it", async () => {
        let remote = editableLoader([{ id: "one", data: { title: "One" } }]);
        let content = await createContent(c => ({
            blog: c.collection({ loader: remote.loader, schema: post }),
        }));
        let hmr = fakeChannel();

        await watchCollections(content, hmr.channel, "/project");
        await content.blog.getCollection();

        expect(hmr.watched).toEqual([]);
    });

    it("reports one reload for a batch that touches two collections", async () => {
        let blog = editableLoader(
            [{ id: "one", data: { title: "One" }, filePath: "content/blog/one.md" }],
            "blog",
        );
        let notes = editableLoader(
            [{ id: "two", data: { title: "Two" }, filePath: "content/notes/two.md" }],
            "notes",
        );
        let content = await createContent(c => ({
            blog: c.collection({ loader: blog.loader, schema: post }),
            notes: c.collection({ loader: notes.loader, schema: post }),
        }));
        let hmr = fakeChannel();
        await watchCollections(content, hmr.channel, "/project");
        await content.blog.getCollection();
        await content.notes.getCollection();

        let emitted = await hmr.report(
            { event: "change", filePath: path.join("/project", "content/blog/one.md") },
            { event: "change", filePath: path.join("/project", "content/notes/two.md") },
        );
        await content.blog.getCollection();
        await content.notes.getCollection();

        expect(emitted).toEqual([{ type: "reload" }]);
        expect(blog.loads).toBe(2);
        expect(notes.loads).toBe(2);
    });
});
