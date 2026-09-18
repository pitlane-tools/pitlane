import type { PrebuiltCollections } from "./types.ts";

import * as manifest from "./manifest.ts";

/**
 * The channel between `content()` and `createContent`.
 *
 * The plugin runs the application's content module through Vite's module
 * runner, which evaluates it in a realm of its own. A module-scoped variable
 * would therefore be a different variable on each side, so the handshake lives
 * on `globalThis` under a symbol nothing else can name.
 */
const CHANNEL = Symbol.for("pitlane.content.prebuild");

interface Channel {
    collections: Map<string, unknown[]>;
    root: string;
}

interface Global {
    [CHANNEL]?: Channel;
}

/** Opens prebuild mode. Called by `content()` before it runs the entry. */
export function openPrebuild(root: string): Map<string, unknown[]> {
    let channel: Channel = { collections: new Map(), root };
    (globalThis as Global)[CHANNEL] = channel;
    return channel.collections;
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
 * The manifest `content()` emitted, or `null` when nothing prebuilt anything.
 *
 * Read through the namespace rather than a default import so that replacing the
 * module in dev is observed by the next call instead of by the next restart.
 */
export function prebuilt(): PrebuiltCollections | null {
    return manifest.default;
}
