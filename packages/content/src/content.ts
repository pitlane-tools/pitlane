import type {
    CollectionDefinition,
    Entry,
    Content,
    ContentBuilder,
    ContentLoader,
    Loader,
    LiveLoader,
    PrebuiltEntry,
    StandardSchemaV1,
} from "./types.ts";

import { ContentError, missingRenderer, parseEntryData } from "./parse.ts";
import {
    contentRoot,
    isPrebuilding,
    prebuiltManifest,
    recordConfiguredSatteri,
    recordPrebuilt,
    recordWatched,
    registerPrebuild,
} from "./prebuild.ts";
import { reference } from "./reference.ts";
import { collectionStore, type StoredEntry } from "./store.ts";
import { HOT_COLLECTION } from "./symbols.ts";

/**
 * Declares a set of content collections.
 *
 * Returns the collection object synchronously without loading entries.
 * Reads and rendering remain asynchronous. Declaration errors throw here.
 *
 * Under `contentLayer()`, registers deferred population work. The plugin
 * awaits it after evaluating the declarations and before emitting the bundle.
 */
export function createContent<T extends Record<string, CollectionDefinition>>(
    build: (c: ContentBuilder) => T,
): Content<T> {
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

    let manifest = prebuiltManifest();
    let content: Record<string, unknown> = {};
    for (let [name, definition] of Object.entries(definitions)) {
        content[name] = wire(name, definition, manifest?.[name]);
    }

    if (isPrebuilding()) registerPrebuild(() => populateEagerly(content, definitions));
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
    let listeners = new Set<(files: string[]) => void>();

    function entries() {
        // Memoized on both paths. The manifest is immutable for the life of the
        // module, so rebuilding its store per read would re-run the duplicate
        // check, mint fresh entries, and defeat the render cache that keys off
        // them — worst on a prerender, which reads every collection once per
        // page.
        if (prebuiltEntries) {
            populated ??= Promise.resolve(fromManifest(name, prebuiltEntries));
            return populated;
        }
        populated ??= runLoader(name, schema, loader)
            .then(stored => {
                // After the memo is in place, so a listener reading the
                // collection cannot re-enter this load.
                announce(stored);
                return stored;
            })
            .catch((error: unknown) => {
                populated = undefined;
                throw error;
            });
        return populated;
    }

    function announce(stored: Map<string, StoredEntry>) {
        if (listeners.size === 0) return;
        let files = [
            ...new Set(
                [...stored.values()]
                    .map(entry => entry.filePath)
                    .filter(filePath => filePath !== undefined),
            ),
        ];
        for (let listener of listeners) listener(files);
    }

    return {
        ...queries(name, entries),
        /**
         * The seam `@pitlane/content/hot` reads. Prebuilt entries have no files
         * to watch and cannot be reloaded, so that collection offers nothing.
         */
        [HOT_COLLECTION]: prebuiltEntries
            ? undefined
            : {
                  invalidate() {
                      populated = undefined;
                  },
                  onPopulated(listener: (files: string[]) => void) {
                      listeners.add(listener);
                      return () => listeners.delete(listener);
                  },
              },
    };
}

async function runLoader(name: string, schema: StandardSchemaV1, loader: ContentLoader) {
    let store = collectionStore(name, contentRoot());
    try {
        await loader.load({
            collection: name,
            root: contentRoot(),
            parseData: input => parseEntryData(schema, { collection: name, ...input }, input.data),
            store: { set: store.set },
        });
    } catch (error) {
        throw annotate(name, error);
    } finally {
        // Reported whether or not the load succeeded. A prebuild that fails is
        // exactly when the author is about to edit one of these files, so
        // dropping the watch set here would mean their fix needs a restart.
        if (isPrebuilding()) recordWatched(loader.watchedPaths?.() ?? []);
    }

    if (isPrebuilding()) {
        recordPrebuilt(name, store.serializable());
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
        async getCollection(filter?: (entry: Entry<unknown>) => unknown) {
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
        async getCollection(filter?: (entry: Entry<unknown>) => unknown) {
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
    filter?: (entry: Entry<unknown>) => unknown,
) {
    let views = entries
        .slice()
        .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
        .map(entry => view(name, entry));
    return filter ? views.filter(entry => filter(entry)) : views;
}

function view(collection: string, entry: StoredEntry): Entry<unknown> {
    return {
        id: entry.id,
        collection,
        data: entry.data,
        ...(entry.filePath === undefined ? {} : { filePath: entry.filePath }),
        // Imported here rather than at module scope because `./render.ts`
        // produces a Remix component and imports Remix's JSX runtime to do it.
        // A static import would make reading a JSON file into a validated
        // collection require the framework. `render()` is already async, so
        // the load costs an application that renders nothing at all.
        render: async () => {
            let renderer = await import("./render.ts").catch((cause: unknown) => {
                throw missingRenderer(`${collection}/${entry.id}`, cause) ?? cause;
            });
            return await renderer.renderedEntry(collection, entry);
        },
    };
}

function fromManifest(name: string, entries: PrebuiltEntry[]) {
    let store = collectionStore(name);
    for (let entry of entries) store.set(entry);
    return store.entries;
}

/**
 * Frames a loader failure with the collection, unless it already names one.
 *
 * Recognised by type rather than by a substring of the message: matching on
 * wording would couple every thrower to this function's idea of what a framed
 * message looks like, and rewording one of them would double-wrap or skip.
 */
function annotate(collection: string, error: unknown) {
    if (error instanceof ContentError) return error;
    let cause = error instanceof Error ? error.message : String(error);
    return new ContentError(collection, `Failed to load collection "${collection}": ${cause}`, {
        cause: error,
    });
}

/** Under `contentLayer()`, every `ContentLoader` collection loads before the build reads it. */
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
