import { ContentError } from "../parse.ts";

/**
 * `node:fs/promises`, or a diagnostic for a host that has none.
 *
 * The import is dynamic on purpose, against this repository's preference for
 * static ones: a static import of `node:fs` makes a Cloudflare Workers bundle
 * fail to *build*, which tells an author nothing. Reaching this code at all
 * means the collection was never prebuilt, so the fix is a line of Vite config
 * rather than a code change, and only a runtime error can say so.
 *
 * Only the import is guarded, and every import failure means the same thing: a
 * builtin module never touches the disk, so it either resolves or is absent.
 * The reads happen at the call site, which is what keeps an ordinary I/O
 * failure — a `base` that does not exist, a file deleted mid-read — surfacing
 * as itself rather than as a claim about the host.
 */
export async function filesystem(collection: string) {
    try {
        return await import("node:fs/promises");
    } catch (error) {
        throw new ContentError(
            collection,
            `Collection "${collection}" has no prebuilt content and no filesystem to read.\n` +
                `Add content() from "@pitlane/content/vite" to your Vite config.`,
            { cause: error },
        );
    }
}
