import type { CompileOptions } from "satteri";

import { extname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import type { ContentLoader, EntryBody, GenerateIdOptions, LoadedEntry } from "../types.ts";

import { filesystem } from "./filesystem.ts";
import { splitFrontmatter } from "./frontmatter.ts";
import { read } from "./read.ts";

/** One parsed file, before an id is derived for it or its data is validated. */
interface Document {
    data: Record<string, unknown>;
    body?: EntryBody;
}

/** A file a pattern matched, read and parsed. */
interface Match {
    /** The matched path, relative to `base`. */
    entry: string;
    extension: string;
    filePath: string;
    document: Document;
}

/**
 * The formats `glob` reads.
 *
 * A match in any other format — including a directory a pattern happened to
 * match — is skipped silently. A pattern is an ordinary value and may be as
 * broad as its author likes, so matching a README is not a mistake worth
 * failing a build over.
 */
let formats: Record<string, (text: string) => Document> = {
    ".md": text => markdown("md", text),
    ".mdx": text => markdown("mdx", text),
    ".json": text => ({ data: JSON.parse(text) as Record<string, unknown> }),
    ".yaml": text => ({ data: (parseYaml(text) ?? {}) as Record<string, unknown> }),
    ".yml": text => ({ data: (parseYaml(text) ?? {}) as Record<string, unknown> }),
};

/**
 * Reads every file a pattern matches as one entry.
 *
 * `pattern` is an ordinary runtime value — computed, read from the environment,
 * or assembled in a loop — because nothing about it is read statically.
 */
export function glob(options: {
    pattern: string | string[];
    base?: string;
    generateId?: (options: GenerateIdOptions) => string;
    satteri?: CompileOptions;
}): ContentLoader {
    // Nothing is resolved here. `createContent` runs this factory at module
    // scope on every host, including the hosts that have no `process` to ask
    // for a working directory, so `context.root` on load is the only root.
    let watched: string[] = [];

    return {
        name: "glob",
        async load(context) {
            let base = resolve(context.root, options.base ?? ".");
            watched = watchedDirectories(base, options.pattern);
            let fs = await filesystem(context.collection);
            let matches: Match[] = [];

            for await (let match of fs.glob(options.pattern, { cwd: base })) {
                let entry = match.replaceAll("\\", "/");
                let extension = extname(entry);
                let parse = formats[extension];
                if (!parse) continue;

                let filePath = resolve(base, entry);
                let document = read(parse, await fs.readFile(filePath, "utf8"), filePath);
                matches.push({ entry, extension, filePath, document });
            }

            for (let { id, filePath, document } of identify(matches, base, options.generateId)) {
                // `satteri` rides along on the entry because it configures
                // rendering rather than loading, and `render()` is the only
                // thing that reads it.
                let stored: LoadedEntry & { satteri?: CompileOptions } = {
                    id,
                    data: await context.parseData({ id, data: document.data, filePath }),
                    filePath,
                    body: document.body,
                    satteri: options.satteri,
                };
                context.store.set(stored);
            }
        },
        // Empty until a load has happened, which is all the plugin needs:
        // `runLoader` loads before it records anything to watch.
        watchedPaths: () => watched,
    };
}

/** The syntax that makes a pattern segment a glob rather than a literal name. */
const GLOB_SYNTAX_RE = /[*?[\]{}!()]/;

/**
 * The directories a pattern can match under, resolved against `base`.
 *
 * Watching `base` would watch the project root whenever `base` is left at its
 * default, and then every save anywhere in the project looks like a content
 * change: a whole extra Vite server and a full browser reload for editing an
 * unrelated module. A pattern's leading literal segments are the narrowest
 * directories that still contain everything it can match.
 */
function watchedDirectories(base: string, pattern: string | string[]): string[] {
    let patterns = Array.isArray(pattern) ? pattern : [pattern];
    return [...new Set(patterns.map(one => resolve(base, literalPrefix(one))))];
}

function literalPrefix(pattern: string): string {
    let segments = pattern.replaceAll("\\", "/").split("/");
    let firstGlob = segments.findIndex(segment => GLOB_SYNTAX_RE.test(segment));

    // A pattern holding no glob syntax at all names one file, and the directory
    // holding that file is what a watcher can report a change under.
    return segments.slice(0, firstGlob === -1 ? -1 : firstGlob).join("/");
}

/**
 * Pairs each match with its id, in id order.
 *
 * Sorting here is what keeps a collection from inheriting the order its
 * directories happened to be traversed in.
 */
function identify(
    matches: Match[],
    base: string,
    generateId: ((options: GenerateIdOptions) => string) | undefined,
) {
    return matches
        .map(({ entry, extension, filePath, document }) => ({
            id:
                generateId?.({ entry, base, data: document.data }) ??
                entry.slice(0, -extension.length),
            filePath,
            document,
        }))
        .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

function markdown(format: "md" | "mdx", text: string): Document {
    let { data, body } = splitFrontmatter(text);
    return { data, body: { format, source: body } };
}
