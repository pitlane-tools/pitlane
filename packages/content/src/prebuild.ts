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
    root: string;
}

interface Global {
    [CHANNEL]?: Channel;
    [MANIFEST]?: PrebuiltCollections;
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
