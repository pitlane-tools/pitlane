import type { CompileOptions } from "satteri";

import { extname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import type { ContentLoader, EntryBody, GenerateIdOptions, LoadedEntry } from "../types.ts";

import { filesystem } from "./filesystem.ts";
import { splitFrontmatter } from "./frontmatter.ts";

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
    // Resolved against `context.root` on load, and against the working
    // directory until then, so `watchedPaths()` answers before a load too.
    let base = resolve(process.cwd(), options.base ?? ".");

    return {
        name: "glob",
        async load(context) {
            base = resolve(context.root, options.base ?? ".");
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
        watchedPaths: () => [base],
    };
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

/**
 * Parses one file, naming it when the parse fails.
 *
 * Malformed frontmatter and malformed JSON are the two most likely authoring
 * mistakes here, and the parsers report a line and column relative to the
 * snippet they were handed. Without the path that is unactionable in a
 * collection of any size.
 */
function read(parse: (text: string) => Document, text: string, filePath: string): Document {
    try {
        return parse(text);
    } catch (error) {
        let cause = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse "${filePath}": ${cause}`, { cause: error });
    }
}

function markdown(format: "md" | "mdx", text: string): Document {
    let { data, body } = splitFrontmatter(text);
    return { data, body: { format, source: body } };
}
