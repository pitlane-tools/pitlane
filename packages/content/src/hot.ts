import * as path from "node:path";

import { contentRoot } from "./prebuild.ts";
import { HOT_COLLECTION } from "./symbols.ts";

/** A file change the supervisor's watcher observed. */
export interface FileEvent {
    event: "add" | "change" | "unlink";
    filePath: string;
}

/** An event for the browser HMR client. Only a reload is meaningful for content. */
interface BrowserEvent {
    type: "reload";
    files?: string[];
}

/**
 * The part of `remix/node-hmr`'s `BrowserHmrChannel` this module uses.
 *
 * Declared structurally rather than imported, because importing the module
 * that declares it would pull a Node-only dependency into every bundle this
 * package reaches. The import in {@link hotContent} is the only one, and it is
 * dynamic and guarded.
 */
export interface BrowserHmrChannel {
    readonly url: string;
    close(): void;
    onFileEvents(
        handler: (events: readonly FileEvent[]) => Promise<readonly BrowserEvent[]>,
    ): () => void;
    updateWatchedFiles(delta: { add: readonly string[]; remove: readonly string[] }): void;
}

interface HotCollection {
    invalidate(): void;
    onPopulated(listener: (files: string[]) => void): () => void;
}

/**
 * Reloads the browser when a file behind a collection changes.
 *
 * Call it once, beside `createContent`, and leave it in for production: it
 * does nothing unless `remix/node-hmr` is supervising the process, which is
 * what a `dev` command does and a production server does not. That is also why
 * the import below is dynamic — `remix/node-hmr/runtime` is Node-only and can
 * only be imported by a supervised child, so a static import would follow this
 * module into a Worker bundle.
 *
 * @param content The object `createContent` returned.
 */
export async function hotContent(content: Record<string, unknown>): Promise<void> {
    if (!process.env.REMIX_NODE_HMR) return;

    let { createBrowserHmrChannel } = await import("remix/node-hmr/runtime");
    await watchCollections(content, await createBrowserHmrChannel(), contentRoot());
}

/**
 * The watching itself, over a channel someone else opened.
 *
 * Separated from {@link hotContent} so it can be driven by a channel a test
 * controls: the real one exists only inside a process `remix/node-hmr` started.
 *
 * @internal
 */
export async function watchCollections(
    content: Record<string, unknown>,
    channel: BrowserHmrChannel,
    root: string,
): Promise<void> {
    /** Which collection each watched file belongs to, so an event finds its owner. */
    let owners = new Map<string, Set<HotCollection>>();

    for (let collection of Object.values(content)) {
        let hot = handle(collection);
        if (!hot) continue;

        let watched: string[] = [];
        hot.onPopulated(files => {
            let absolute = files.map(file => path.resolve(root, file));
            channel.updateWatchedFiles({ add: absolute, remove: watched });
            for (let file of watched) owners.get(file)?.delete(hot);
            for (let file of absolute) {
                let set = owners.get(file) ?? new Set();
                set.add(hot);
                owners.set(file, set);
            }
            watched = absolute;
        });
    }

    channel.onFileEvents(async events => {
        let stale = new Set<HotCollection>();
        for (let { filePath } of events) {
            for (let owner of owners.get(path.resolve(root, filePath)) ?? []) stale.add(owner);
        }
        if (stale.size === 0) return [];

        for (let collection of stale) collection.invalidate();

        // One reload however many files were saved together: the page is
        // re-requested once, and every invalidated collection re-reads.
        return [{ type: "reload" }];
    });
}

function handle(collection: unknown): HotCollection | undefined {
    if (typeof collection !== "object" || collection === null) return undefined;
    return (collection as Record<symbol, HotCollection | undefined>)[HOT_COLLECTION];
}
