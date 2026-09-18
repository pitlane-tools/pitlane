import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { ContentLoader, LoadedEntry } from "../types.ts";

import { file } from "./file.ts";

let fixtures = fileURLToPath(new URL("../fixtures", import.meta.url));

async function collect(loader: ContentLoader, collection = "authors") {
    let stored: LoadedEntry[] = [];
    await loader.load({
        collection,
        root: process.cwd(),
        async parseData({ data }) {
            return data as never;
        },
        store: {
            set(entry) {
                stored.push(entry);
            },
        },
    });
    return stored;
}

describe("loaders.file", () => {
    it("reads one file holding many entries, taking each item's id", async () => {
        let entries = await collect(file(`${fixtures}/authors.json`));

        expect(entries.map(entry => entry.id)).toEqual(["ada", "grace"]);
    });

    it("removes id from the data it validates, because it is the entry's id", async () => {
        let entries = await collect(file(`${fixtures}/authors.json`));

        expect(entries[0]!.data).toEqual({ name: "Ada Lovelace", avatar: "/ada.png" });
    });

    it("uses an object result's keys as ids", async () => {
        let entries = await collect(file(`${fixtures}/authors-keyed.json`));

        expect(entries.map(entry => entry.id)).toEqual(["ada", "grace"]);
        expect(entries[0]!.data).toEqual({ name: "Ada Lovelace", avatar: "/ada.png" });
    });

    it("names the offending index when an array item carries no string id", async () => {
        await expect(collect(file(`${fixtures}/authors-unidentified.json`))).rejects.toThrow(
            /index 0/,
        );
    });

    it("parses .yaml with the yaml parser", async () => {
        let entries = await collect(file(`${fixtures}/settings.yaml`));

        expect(entries.map(entry => entry.id)).toEqual(["site"]);
        expect(entries[0]!.data).toEqual({
            name: "Pitlane",
            tagline: "A meta-framework for Remix 3",
        });
    });

    it("produces entries with no body, so they are data rather than documents", async () => {
        let entries = await collect(file(`${fixtures}/authors.json`));

        expect(entries.every(entry => entry.body === undefined)).toBe(true);
    });

    it("reports the file it read so the plugin can watch it", () => {
        let loader = file(`${fixtures}/authors.json`);

        expect(loader.watchedPaths?.()).toEqual([`${fixtures}/authors.json`]);
    });

    it("refuses an extension it has no parser for, naming the option that fixes it", async () => {
        await expect(collect(file(`${fixtures}/notes.txt`))).rejects.toThrow(
            /No parser for "\.txt"; pass options\.parser to loaders\.file\./,
        );
    });

    it("uses options.parser when one is given", async () => {
        let entries = await collect(
            file(`${fixtures}/notes.txt`, {
                parser: text => ({ note: { text: text.trim() } }),
            }),
        );

        expect(entries).toEqual([
            {
                id: "note",
                data: { text: "not a content format" },
                filePath: `${fixtures}/notes.txt`,
            },
        ]);
    });
});
