import { readFileSync } from "node:fs";
import path from "node:path";

import type { FencedBlock } from "./support/markdown.ts";

import { fencedBlocks, guideFiles, packageReadmes } from "./support/markdown.ts";

interface Audience {
    file: string;
    reader: "guide" | "README";
}

const SPECIFIER = /\b(?:from|import)\s*\(?\s*(["'])([^"']+)\1/g;
const MARKER_TEXT = "policy.0014: scoped package";
const MARKERS = {
    md: {
        comment: `<!-- ${MARKER_TEXT} -->`,
        pattern: /^\s*<!--.*policy\.0014: scoped package.*-->\s*$/,
    },
    mdx: {
        comment: `{/* ${MARKER_TEXT} */}`,
        pattern: /^\s*\{\s*\/\*.*policy\.0014: scoped package.*\*\/\s*\}\s*$/,
    },
};

function markerFor(file: string) {
    return file.endsWith(".mdx") ? MARKERS.mdx : MARKERS.md;
}

function misdirected(specifier: string, { file, reader }: Audience) {
    if (reader === "guide" && specifier.startsWith("@pitlane/")) {
        return `app-facing guides import through the umbrella as "${specifier.slice(1)}", or mark a deliberate scoped import with ${markerFor(file).comment} before the fence`;
    }
    if (reader === "README" && specifier.startsWith("pitlane/")) {
        return `package READMEs import the package directly as "@${specifier}"`;
    }
    return undefined;
}

function isMarked(block: FencedBlock, lines: string[], { file, reader }: Audience) {
    if (reader !== "guide") return false;
    let previous = lines
        .slice(0, block.line - 1)
        .reverse()
        .find(line => line.trim() !== "");
    return previous !== undefined && markerFor(file).pattern.test(previous);
}

function violations(audience: Audience, source: string) {
    let lines = source.split(/\r?\n/);
    let found: string[] = [];
    let unmarked = fencedBlocks(source).filter(block => !isMarked(block, lines, audience));
    for (let { line, text } of unmarked.flatMap(block => block.lines)) {
        for (let [, , specifier] of text.matchAll(SPECIFIER)) {
            let remedy = misdirected(specifier, audience);
            if (remedy)
                found.push(
                    `${audience.file}:${line}: ${audience.reader} imports "${specifier}"; ${remedy} (policy.0014)`,
                );
        }
    }
    return found;
}

export function check(root: string): string[] {
    let audiences: Audience[] = [
        ...guideFiles(root).map(file => ({ file, reader: "guide" as const })),
        ...packageReadmes(root)
            .filter(readme => readme.published)
            .map(readme => ({ file: readme.path, reader: "README" as const })),
    ];
    return audiences.flatMap(audience =>
        violations(audience, readFileSync(path.join(root, audience.file), "utf8")),
    );
}
