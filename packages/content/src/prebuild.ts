import type { PrebuiltCollections } from "./types.ts";

import { PREBUILD_CHANNEL, PREBUILT_MANIFEST } from "./symbols.ts";

// Imported for its side effect: `contentLayer()` replaces this module with one that
// registers the manifest it emitted. See the note in `manifest.ts`.
import "./manifest.ts";

/**
 * The channel between `contentLayer()` and `createContent`.
 *
 * The plugin runs the application's content module through Vite's module
 * runner, which evaluates it in a realm of its own. A module-scoped variable
 * would therefore be a different variable on each side, so the handshake lives
 * on globals whose names `symbols.ts` owns.
 */

interface Channel {
    collections: Map<string, unknown[]>;
    watched: Set<string>;
    /** Collections whose loader configured runtime rendering options. */
    configuredSatteri: Set<string>;
    /** `createContent` calls that started and have not finished. */
    inFlight: number;
    root: string;
}

interface Global {
    [PREBUILD_CHANNEL]?: Channel;
    [PREBUILT_MANIFEST]?: PrebuiltCollections;
}

/** Opens prebuild mode. Called by `contentLayer()` before it runs the entry. */
export function openPrebuild(root: string): Channel {
    let channel: Channel = {
        collections: new Map(),
        watched: new Set(),
        configuredSatteri: new Set(),
        inFlight: 0,
        root,
    };
    (globalThis as Global)[PREBUILD_CHANNEL] = channel;
    return channel;
}

/** Closes prebuild mode, so a later `createContent` in this process is normal. */
export function closePrebuild(): void {
    delete (globalThis as Global)[PREBUILD_CHANNEL];
}

/** Whether `createContent` should populate eagerly and record what it loaded. */
export function isPrebuilding(): boolean {
    return (globalThis as Global)[PREBUILD_CHANNEL] !== undefined;
}

/**
 * The root loaders resolve relative paths against.
 *
 * A prebuilt collection never asks, so the fallback only runs where a loader
 * is about to read the filesystem anyway. `process` is reached defensively all
 * the same: a host without it should hear about the missing filesystem from
 * the loader, which names the collection, rather than about a missing global.
 */
export function contentRoot(): string {
    let root = (globalThis as Global)[PREBUILD_CHANNEL]?.root;
    if (root !== undefined) return root;
    return typeof process === "undefined" ? "/" : process.cwd();
}

/**
 * Marks a `createContent` call as started, and returns its completion callback.
 *
 * `contentLayer()` uses this to notice an entry module that declares collections
 * without awaiting them. `ssrLoadModule` resolves as soon as the module body
 * does, so every later `recordPrebuilt` would no-op into a closed channel and
 * the build would emit an empty manifest — working on Node and failing only on
 * a host with no filesystem. An unfinished call is what distinguishes "this
 * app has no prebuildable collections" from "nobody waited for them".
 */
export function beginContent(): () => void {
    let channel = (globalThis as Global)[PREBUILD_CHANNEL];
    if (!channel) return () => {};
    channel.inFlight += 1;
    return () => {
        channel.inFlight -= 1;
    };
}

/** Whether any `createContent` call started and never finished. */
export function unfinishedContent(): boolean {
    return ((globalThis as Global)[PREBUILD_CHANNEL]?.inFlight ?? 0) > 0;
}

/** Records one collection's entries for `contentLayer()` to read back. */
export function recordPrebuilt(collection: string, entries: unknown[]): void {
    (globalThis as Global)[PREBUILD_CHANNEL]?.collections.set(collection, entries);
}

/**
 * Records the paths a loader says it reads, so `contentLayer()` can watch them.
 *
 * This comes from the loader rather than from the entries it produced: a
 * collection that currently matches nothing has no file paths to infer from,
 * and it is exactly the collection whose first file needs to be noticed.
 */
export function recordWatched(paths: readonly string[]): void {
    let channel = (globalThis as Global)[PREBUILD_CHANNEL];
    if (!channel) return;
    for (let path of paths) channel.watched.add(path);
}

/**
 * Records that a prebuilt collection's loader configured `options.satteri`.
 *
 * Those options only take effect when the collection renders at runtime, so a
 * prebuilt collection carrying them has a plugin list that silently applies on
 * some hosts and not others. `contentLayer()` warns rather than let that pass.
 */
export function recordConfiguredSatteri(collection: string): void {
    (globalThis as Global)[PREBUILD_CHANNEL]?.configuredSatteri.add(collection);
}

/**
 * The manifest `contentLayer()` emitted, or `null` when nothing prebuilt anything.
 *
 * A prebuild reads no manifest, because it is producing one. Without that rule
 * a process that has already imported a prebuilt bundle — two builds in one
 * test run, a build after a preview — would hand the next prebuild the previous
 * manifest, the loaders would look as though they had already run, and the
 * collection would be emitted empty.
 */
export function prebuiltManifest(): PrebuiltCollections | null {
    if (isPrebuilding()) return null;
    return (globalThis as Global)[PREBUILT_MANIFEST] ?? null;
}
