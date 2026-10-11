import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { isPublished, type Manifest } from "./packages.ts";

export interface CodeLine {
    line: number;
    text: string;
}

export interface FencedBlock {
    line: number;
    info: string;
    lines: CodeLine[];
}

export interface PackageReadme {
    path: string;
    name: string;
    published: boolean;
}

const GUIDE_DIRECTORIES = ["guides", "deployment", "_partials"].map(
    name => `docs/app/content/${name}`,
);
const OPENING_FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const CLOSING_FENCE = /^\s*(`{3,}|~{3,})\s*$/;

function closes(line: string, opener: string) {
    let fence = CLOSING_FENCE.exec(line)?.[1];
    return fence !== undefined && fence[0] === opener[0] && fence.length >= opener.length;
}

export function fencedBlocks(source: string): FencedBlock[] {
    let blocks: FencedBlock[] = [];
    let open: (FencedBlock & { fence: string }) | undefined;
    for (let [index, text] of source.split(/\r?\n/).entries()) {
        let line = index + 1;
        if (open) {
            if (closes(text, open.fence)) {
                blocks.push({ line: open.line, info: open.info, lines: open.lines });
                open = undefined;
            } else {
                open.lines.push({ line, text });
            }
            continue;
        }
        let match = OPENING_FENCE.exec(text);
        if (!match) continue;
        let [, fence, info] = match;
        if (fence[0] === "`" && info.includes("`")) continue;
        open = { line, info: info.trim(), lines: [], fence };
    }
    if (open) blocks.push({ line: open.line, info: open.info, lines: open.lines });
    return blocks;
}

function markdownFiles(root: string, directory: string): string[] {
    let absolute = path.join(root, directory);
    if (!existsSync(absolute)) return [];
    return readdirSync(absolute, { recursive: true, encoding: "utf8" })
        .filter(file => /\.mdx?$/.test(file))
        .map(file => path.posix.join(directory, file.split(path.sep).join("/")));
}

export function guideFiles(root: string): string[] {
    return GUIDE_DIRECTORIES.flatMap(directory => markdownFiles(root, directory)).sort();
}

export function packageReadmes(root: string): PackageReadme[] {
    let packages = path.join(root, "packages");
    if (!existsSync(packages)) return [];
    return readdirSync(packages)
        .sort()
        .flatMap(directory => {
            let manifestPath = path.join(packages, directory, "package.json");
            let readmePath = `packages/${directory}/README.md`;
            if (!existsSync(manifestPath) || !existsSync(path.join(root, readmePath))) return [];
            let manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
            return [{ path: readmePath, name: manifest.name, published: isPublished(manifest) }];
        });
}
