import { extname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import type { ContentLoader } from "../types.ts";

import { filesystem } from "./filesystem.ts";
import { read } from "./read.ts";

type Parser = (text: string) => Record<string, unknown> | unknown[];

/**
 * Reads one file holding many entries.
 *
 * Every entry is data rather than a document: a file of records has no body to
 * render, so `render()` on one of these entries is a mistake and says so.
 */
export function file(fileName: string, options?: { parser?: Parser }): ContentLoader {
    // Nothing is resolved here. `createContent` runs this factory at module
    // scope on every host, including the hosts that have no `process` to ask
    // for a working directory, so `context.root` on load is the only root.
    let watched: string[] = [];

    return {
        name: "file",
        async load(context) {
            let filePath = resolve(context.root, fileName);
            watched = [filePath];
            let parse = parserFor(extname(filePath), options?.parser);
            let fs = await filesystem(context.collection);
            let parsed = read<unknown>(parse, await fs.readFile(filePath, "utf8"), filePath);
            let entries = entriesOf(parsed, filePath);

            for (let [id, data] of entries) {
                context.store.set({
                    id,
                    data: await context.parseData({ id, data, filePath }),
                    filePath,
                });
            }
        },
        // Empty until a load has happened, which is all the plugin needs:
        // `runLoader` loads before it records anything to watch.
        watchedPaths: () => watched,
    };
}

function parserFor(extension: string, custom: Parser | undefined): Parser {
    if (custom) return custom;
    if (extension === ".json") return JSON.parse;
    if (extension === ".yaml" || extension === ".yml") return parseYaml;
    throw new Error(`No parser for "${extension}"; pass options.parser to loaders.file.`);
}

/**
 * The entries a parse result holds, refusing a result that holds none.
 *
 * `JSON.parse` and the YAML parser both answer with whatever the file says,
 * including `null` for an empty document or a bare scalar for a stray one, and
 * `Object.entries` on either of those reports a type error naming neither the
 * file nor the shape the loader wanted.
 */
function entriesOf(parsed: unknown, filePath: string): [string, unknown][] {
    if (Array.isArray(parsed)) return fromArray(parsed, filePath);
    if (!parsed || typeof parsed !== "object") {
        throw new Error(
            `Parsing "${filePath}" produced ${parsed === null ? "null" : typeof parsed}; ` +
                `loaders.file needs an object whose keys are entry ids, or an array of ` +
                `entries each carrying an id.`,
        );
    }

    return Object.entries(parsed);
}

/** An array's items carry their own ids, which are not part of their data. */
function fromArray(items: unknown[], filePath: string): [string, unknown][] {
    return items.map((item, index): [string, unknown] => {
        if (!identified(item)) {
            throw new Error(
                `Entry at index ${index} of "${filePath}" has no string id; ` +
                    `every item in an array needs one to become its entry id.`,
            );
        }

        let { id, ...data } = item;
        return [id, data];
    });
}

function identified(item: unknown): item is Record<string, unknown> & { id: string } {
    return !!item && typeof item === "object" && "id" in item && typeof item.id === "string";
}
