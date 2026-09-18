import { extname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import type { ContentLoader } from "../types.ts";

import { filesystem } from "./filesystem.ts";

type Parser = (text: string) => Record<string, unknown> | unknown[];

/**
 * Reads one file holding many entries.
 *
 * Every entry is data rather than a document: a file of records has no body to
 * render, so `render()` on one of these entries is a mistake and says so.
 */
export function file(fileName: string, options?: { parser?: Parser }): ContentLoader {
    // Resolved against `context.root` on load, and against the working
    // directory until then, so `watchedPaths()` answers before a load too.
    let filePath = resolve(process.cwd(), fileName);

    return {
        name: "file",
        async load(context) {
            filePath = resolve(context.root, fileName);
            let parse = parserFor(extname(filePath), options?.parser);
            let fs = await filesystem(context.collection);
            let parsed = parse(await fs.readFile(filePath, "utf8"));
            let entries = Array.isArray(parsed)
                ? fromArray(parsed, filePath)
                : Object.entries(parsed);

            for (let [id, data] of entries) {
                context.store.set({
                    id,
                    data: await context.parseData({ id, data, filePath }),
                    filePath,
                });
            }
        },
        watchedPaths: () => [filePath],
    };
}

function parserFor(extension: string, custom: Parser | undefined): Parser {
    if (custom) return custom;
    if (extension === ".json") return JSON.parse;
    if (extension === ".yaml" || extension === ".yml") return parseYaml;
    throw new Error(`No parser for "${extension}"; pass options.parser to loaders.file.`);
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
