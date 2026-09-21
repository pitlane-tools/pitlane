import type { Plugin } from "vite";

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { type BuildMode, isBuildMode } from "./build-modes.ts";

const INCLUDE = /<!--\s*@include:\s*([^\s>]+?\.md)\s*-->/g;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const BUILD_FIELD = /^build:\s*(\S+)\s*$/m;
const FENCE = /^(:{3,})\s*(\S*)\s*$/;
const CODE_FENCE = /^\s*(`{3,}|~{3,})/;

/** The mode a page declared, or `undefined` for a page that offers no toggle. */
function declaredMode(source: string): BuildMode | undefined {
    let frontmatter = FRONTMATTER.exec(source)?.[1];
    let declared = frontmatter && BUILD_FIELD.exec(frontmatter)?.[1];
    return declared && isBuildMode(declared) ? declared : undefined;
}

/** One open `:::` container, and whether its contents survive. */
interface Fence {
    colons: number;
    kind: "drop" | "keep" | "other";
}

/**
 * The source with every `::: vite` / `::: no-build` section that does not
 * belong to `mode` removed, and the surviving mode's own fences with it.
 *
 * Containers close innermost-first against a closer at least as wide, which is
 * `markdown-it`'s own rule: a mode section may hold a `::: tip` and be held by
 * a `:::: vite` in turn. Lines inside a fenced code block are text, so a guide
 * can show this syntax without the example resolving itself away.
 */
function strip(source: string, mode: BuildMode | undefined, where: string): string {
    let kept: string[] = [];
    let open: Fence[] = [];
    let code: string | undefined;

    for (let line of source.split("\n")) {
        let codeFence = CODE_FENCE.exec(line)?.[1];
        let dropping = open.some(fence => fence.kind === "drop");

        if (code) {
            if (codeFence && codeFence[0] === code[0] && codeFence.length >= code.length) {
                code = undefined;
            }
            if (!dropping) kept.push(line);
            continue;
        }

        if (codeFence) {
            code = codeFence;
            if (!dropping) kept.push(line);
            continue;
        }

        let fence = FENCE.exec(line);
        if (!fence) {
            if (!dropping) kept.push(line);
            continue;
        }

        let [, colons, name] = fence;

        if (name) {
            if (!isBuildMode(name)) {
                open.push({ colons: colons.length, kind: "other" });
                if (!dropping) kept.push(line);
                continue;
            }
            if (!mode) {
                throw new Error(
                    `${where} has a "${line.trim()}" section, but the page including it ` +
                        `declares no "build:" in its frontmatter, so the section would be ` +
                        `dropped without a word. Add "build: vite" or "build: no-build".`,
                );
            }
            open.push({ colons: colons.length, kind: name === mode ? "keep" : "drop" });
            continue;
        }

        let innermost = open.at(-1);
        if (innermost && colons.length >= innermost.colons) {
            open.pop();
            if (innermost.kind === "other" && !dropping) kept.push(line);
            continue;
        }

        if (!dropping) kept.push(line);
    }

    return kept.join("\n");
}

/**
 * Resolves `::: vite` and `::: no-build` sections against the page's declared
 * mode, in the source text, before anything reads it.
 *
 * It has to happen here rather than in `markdown-it`. A docs page is not only
 * its HTML: the outline is built from the headings in the DOM, the local search
 * index from the page's text, and `vitepress-plugin-llms` resolves includes
 * itself and emits a Markdown twin of every page without ever going through
 * `markdown-it`. Resolving in the one place all of them read from is what keeps
 * them describing one setup instead of two — and keeps the rule in one place
 * rather than one per surface.
 *
 * That also means resolving the include: a page's own source is frontmatter and
 * `<!--@include: ./_partial.md-->`, so the sections are not in it yet. Only the
 * plain form is resolved, leaving snippet ranges and regions to the readers
 * that already understand them.
 */
export function buildModes(): Plugin {
    return {
        name: "pitlane-build-modes",
        enforce: "pre",

        transform(source, id) {
            if (!id.endsWith(".md")) return null;

            let mode = declaredMode(source);
            let inlined = source.replace(INCLUDE, (match, relative: string) => {
                let path = resolve(dirname(id.replace(/[?#].*$/, "")), relative);
                try {
                    return strip(readFileSync(path, "utf8"), mode, relative);
                } catch (error) {
                    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
                        return match;
                    }
                    throw error;
                }
            });

            let resolved = strip(inlined, mode, id);
            return resolved === source ? null : resolved;
        },
    };
}
