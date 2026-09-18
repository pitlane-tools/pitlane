import type { PrebuiltCollections } from "./types.ts";

// Imported for its side effect: `content()` replaces this module with one that
// registers the manifest it emitted. See the note in `manifest.ts`.
import "./manifest.ts";

/**
 * The channel between `content()` and `createContent`.
 *
 * The plugin runs the application's content module through Vite's module
 * runner, which evaluates it in a realm of its own. A module-scoped variable
 * would therefore be a different variable on each side, so the handshake lives
 * on `globalThis` under a symbol nothing else can name.
 */
const CHANNEL = Symbol.for("pitlane.content.prebuild");
// The module `content()` emits assigns this symbol. Its spelling is the
// contract between the plugin and the runtime; see `vite.ts`.
const MANIFEST = Symbol.for("pitlane.content.manifest");

interface Channel {
    collections: Map<string, unknown[]>;
    watched: Set<string>;
    /** Collections whose loader configured runtime rendering options. */
    configuredSatteri: Set<string>;
    root: string;
}

interface Global {
    [CHANNEL]?: Channel;
    [MANIFEST]?: PrebuiltCollections;
}

/** Opens prebuild mode. Called by `content()` before it runs the entry. */
export function openPrebuild(root: string): Channel {
    let channel: Channel = {
        collections: new Map(),
        watched: new Set(),
        configuredSatteri: new Set(),
        root,
    };
    (globalThis as Global)[CHANNEL] = channel;
    return channel;
}

/** Closes prebuild mode, so a later `createContent` in this process is normal. */
export function closePrebuild(): void {
    delete (globalThis as Global)[CHANNEL];
}

/** Whether `createContent` should populate eagerly and record what it loaded. */
export function prebuilding(): boolean {
    return (globalThis as Global)[CHANNEL] !== undefined;
}

/** The root loaders resolve relative paths against. */
export function contentRoot(): string {
    return (globalThis as Global)[CHANNEL]?.root ?? process.cwd();
}

/** Records one collection's entries for `content()` to read back. */
export function recordPrebuilt(collection: string, entries: unknown[]): void {
    (globalThis as Global)[CHANNEL]?.collections.set(collection, entries);
}

/**
 * Records the paths a loader says it reads, so `content()` can watch them.
 *
 * This comes from the loader rather than from the entries it produced: a
 * collection that currently matches nothing has no file paths to infer from,
 * and it is exactly the collection whose first file needs to be noticed.
 */
export function recordWatched(paths: readonly string[]): void {
    let channel = (globalThis as Global)[CHANNEL];
    if (!channel) return;
    for (let path of paths) channel.watched.add(path);
}

/**
 * Records that a prebuilt collection's loader configured `options.satteri`.
 *
 * Those options only take effect when the collection renders at runtime, so a
 * prebuilt collection carrying them has a plugin list that silently applies on
 * some hosts and not others. `content()` warns rather than let that pass.
 */
export function recordConfiguredSatteri(collection: string): void {
    (globalThis as Global)[CHANNEL]?.configuredSatteri.add(collection);
}

/**
 * The manifest `content()` emitted, or `null` when nothing prebuilt anything.
 *
 * A prebuild reads no manifest, because it is producing one. Without that rule
 * a process that has already imported a prebuilt bundle — two builds in one
 * test run, a build after a preview — would hand the next prebuild the previous
 * manifest, the loaders would look as though they had already run, and the
 * collection would be emitted empty.
 */
export function prebuilt(): PrebuiltCollections | null {
    if (prebuilding()) return null;
    return (globalThis as Global)[MANIFEST] ?? null;
}
