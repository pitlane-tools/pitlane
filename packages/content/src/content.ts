import type {
    CollectionDefinition,
    CollectionEntry,
    Content,
    ContentBuilder,
    ContentLoader,
    Loader,
    LiveLoader,
    PrebuiltEntry,
    StandardSchemaV1,
} from "./types.ts";

import { parseEntryData } from "./parse.ts";
import {
    contentRoot,
    prebuilding,
    prebuilt,
    recordConfiguredSatteri,
    recordPrebuilt,
    recordWatched,
} from "./prebuild.ts";
import { reference } from "./reference.ts";
import { renderedEntry } from "./render.ts";
import { collectionStore, type StoredEntry } from "./store.ts";

/**
 * Declares a set of content collections.
 *
 * Calls `build` once and performs no I/O, so a module that declares content
 * does nothing asynchronous at import time. That is not an optimization:
 * Cloudflare Workers forbids asynchronous I/O in global scope, and this is
 * called at module scope. Each collection populates on its first read instead.
 *
 * The exception is a build running under `content()`, where every
 * `ContentLoader` collection is populated eagerly so the result can be inlined
 * into the bundle.
 */
export async function createContent<T extends Record<string, CollectionDefinition>>(
    build: (c: ContentBuilder) => T,
): Promise<Content<T>> {
    let referenced: string[] = [];
    let definitions = build({
        collection: input => input,
        reference(name) {
            referenced.push(name);
            return reference(name);
        },
    });

    let names = Object.keys(definitions);
    for (let name of referenced) {
        if (!Object.hasOwn(definitions, name)) {
            throw new Error(
                `Unknown collection "${name}" referenced by createContent; ` +
                    `known collections are ${names.join(", ")}.`,
            );
        }
    }

    let manifest = prebuilt();
    let content: Record<string, unknown> = {};
    for (let [name, definition] of Object.entries(definitions)) {
        content[name] = wire(name, definition, manifest?.[name]);
    }

    if (prebuilding()) await populateEagerly(content, definitions);
    return content as Content<T>;
}

function wire(
    name: string,
    definition: CollectionDefinition,
    entries: PrebuiltEntry[] | undefined,
) {
    let loader = definition.loader;
    if (isContentLoader(loader)) {
        return contentCollection(name, definition.schema, loader, entries);
    }
    return liveCollection(name, definition.schema, loader);
}

function isContentLoader(loader: Loader): loader is ContentLoader {
    return "load" in loader && typeof loader.load === "function";
}

/**
 * A collection whose loader resolves it in one execution.
 *
 * Its entries come from the manifest when the build prebuilt them, and from the
 * loader otherwise. A successful population is memoized for the life of the
 * process and concurrent readers share one in-flight load; a failed one is not,
 * so one timed-out fetch does not leave the collection broken until a restart.
 */
function contentCollection(
    name: string,
    schema: StandardSchemaV1,
    loader: ContentLoader,
    prebuiltEntries: PrebuiltEntry[] | undefined,
) {
    let populated: Promise<Map<string, StoredEntry>> | undefined;

    function entries() {
        if (prebuiltEntries) return Promise.resolve(fromManifest(name, prebuiltEntries));
        populated ??= runLoader(name, schema, loader).catch((error: unknown) => {
            populated = undefined;
            throw error;
        });
        return populated;
    }

    return queries(name, entries);
}

async function runLoader(name: string, schema: StandardSchemaV1, loader: ContentLoader) {
    let store = collectionStore(name);
    try {
        await loader.load({
            collection: name,
            root: contentRoot(),
            parseData: input => parseEntryData(schema, { collection: name, ...input }, input.data),
            store: { set: store.set },
        });
    } catch (error) {
        throw annotate(name, error);
    }
    if (prebuilding()) {
        recordPrebuilt(name, store.serializable());
        recordWatched(loader.watchedPaths?.() ?? []);
        if (store.configuredSatteri()) recordConfiguredSatteri(name);
    }
    return store.entries;
}

/**
 * A collection whose loader answers one query at a time.
 *
 * There is nothing to memoize and nothing the build can inline, so every read
 * asks the loader and validates what comes back.
 */
function liveCollection(name: string, schema: StandardSchemaV1, loader: LiveLoader<unknown>) {
    async function validate(entry: { id: string; data: unknown; body?: StoredEntry["body"] }) {
        return {
            id: entry.id,
            data: await parseEntryData(schema, { collection: name, id: entry.id }, entry.data),
            body: entry.body,
        } satisfies StoredEntry;
    }

    return {
        async getCollection(filter?: (entry: CollectionEntry<unknown>) => unknown) {
            let live = await loader.loadCollection().catch((error: unknown) => {
                throw annotate(name, error);
            });
            let entries = await Promise.all(live.map(validate));
            return present(name, entries, filter);
        },
        async getEntry(id: string | { id: string }) {
            let key = typeof id === "string" ? id : id.id;
            let entry = await loader.loadEntry(key).catch((error: unknown) => {
                throw annotate(name, error);
            });
            if (!entry) return undefined;
            return view(name, await validate(entry));
        },
    };
}

function queries(name: string, entries: () => Promise<Map<string, StoredEntry>>) {
    return {
        async getCollection(filter?: (entry: CollectionEntry<unknown>) => unknown) {
            return present(name, [...(await entries()).values()], filter);
        },
        async getEntry(id: string | { id: string }) {
            let key = typeof id === "string" ? id : id.id;
            let entry = (await entries()).get(key);
            return entry ? view(name, entry) : undefined;
        },
    };
}

/** Sorts by id so a prerender never depends on filesystem order, then filters. */
function present(
    name: string,
    entries: StoredEntry[],
    filter?: (entry: CollectionEntry<unknown>) => unknown,
) {
    let views = entries
        .slice()
        .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
        .map(entry => view(name, entry));
    return filter ? views.filter(entry => filter(entry)) : views;
}

function view(collection: string, entry: StoredEntry): CollectionEntry<unknown> {
    return {
        id: entry.id,
        collection,
        data: entry.data,
        ...(entry.filePath === undefined ? {} : { filePath: entry.filePath }),
        render: () => renderedEntry(collection, entry),
    };
}

function fromManifest(name: string, entries: PrebuiltEntry[]) {
    let store = collectionStore(name);
    for (let entry of entries) store.set(entry);
    return store.entries;
}

function annotate(collection: string, error: unknown) {
    if (error instanceof Error && error.message.includes(`collection "${collection}"`))
        return error;
    let cause = error instanceof Error ? error.message : String(error);
    return new Error(`Failed to load collection "${collection}": ${cause}`, { cause: error });
}

/** Under `content()`, every `ContentLoader` collection loads before the build reads it. */
async function populateEagerly(
    content: Record<string, unknown>,
    definitions: Record<string, CollectionDefinition>,
) {
    for (let [name, definition] of Object.entries(definitions)) {
        if (!isContentLoader(definition.loader)) continue;
        let collection = content[name] as { getCollection(): Promise<unknown> };
        await collection.getCollection();
    }
}
