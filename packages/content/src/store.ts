import type { EntryBody, LoadedEntry, PrebuiltBody, PrebuiltEntry } from "./types.ts";

import { ContentError } from "./parse.ts";

/** One entry as the runtime holds it: validated data plus whatever renders it. */
export interface StoredEntry {
    id: string;
    data: unknown;
    filePath?: string;
    /** Raw source, from a loader that read a document. */
    body?: EntryBody;
    /** A compiled module or HTML string, from a manifest the build emitted. */
    prebuilt?: PrebuiltBody;
    /** The runtime rendering options the loader was configured with. */
    satteri?: unknown;
}

/**
 * Collects a collection's entries while its loader runs.
 *
 * An id claimed twice is a conflict rather than a merge. Two files writing one
 * entry means one of them is silently unreachable, which is worth a build
 * failure rather than a coin toss.
 */
export function collectionStore(collection: string, root = "") {
    let entries = new Map<string, StoredEntry>();

    function set(entry: LoadedEntry | PrebuiltEntry) {
        if (entries.has(entry.id)) {
            throw new ContentError(
                collection,
                `Duplicate entry id "${entry.id}" in collection "${collection}".`,
            );
        }
        entries.set(entry.id, stored(entry, root));
    }

    return {
        entries,
        set,
        /** Whether any entry carried runtime rendering options. */
        configuredSatteri(): boolean {
            return [...entries.values()].some(entry => entry.satteri !== undefined);
        },
        /** The entries `content()` reads back, before it compiles any body. */
        serializable(): LoadedEntry[] {
            return [...entries.values()].map(entry => ({
                id: entry.id,
                data: entry.data,
                ...(entry.filePath === undefined ? {} : { filePath: entry.filePath }),
                ...(entry.body === undefined ? {} : { body: entry.body }),
            }));
        },
    };
}

/**
 * Normalizes one entry for the runtime.
 *
 * `filePath` is stored relative to the project root. Absolute would leak the
 * build machine's layout into every shipped bundle, make two machines produce
 * different artifacts from identical source, and give the field two meanings:
 * the build host's path when prebuilt, the serving host's when not.
 */
function stored(entry: LoadedEntry | PrebuiltEntry, root: string): StoredEntry {
    let body = "body" in entry ? entry.body : undefined;
    let raw = body && "source" in body ? body : undefined;
    let compiled = body && !("source" in body) ? body : undefined;
    return {
        id: entry.id,
        data: entry.data,
        filePath: relativeTo(root, entry.filePath),
        body: raw,
        prebuilt: compiled,
        satteri: "satteri" in entry ? entry.satteri : undefined,
    };
}

function relativeTo(root: string, filePath: string | undefined) {
    if (!filePath || !root) return filePath;
    let prefix = `${root.replace(/\\/g, "/").replace(/\/$/, "")}/`;
    let path = filePath.replace(/\\/g, "/");
    return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
