import type { EditToolResultEvent, ExtensionAPI, ToolResultEvent } from "@oh-my-pi/pi-coding-agent";

import { existsSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { stripVTControlCharacters } from "node:util";

// Vale lints the published prose, and only the published prose. Keep this list in sync with
// .vale.ini; the record and the internal documents are deliberately absent.
const PROSE_DIRS = [
    "docs/app/content/_partials/",
    "docs/app/content/deployment/",
    "docs/app/content/guides/",
];

// The lifecycle wiring in AGENTS.md: after every edit to a published page, Vale's findings reach
// the agent in context instead of waiting for `mise run docs:prose` at the end of the turn.
export default function valeProse(pi: ExtensionAPI): void {
    pi.on("tool_result", async (event, ctx) => {
        let files = editedFiles(event, ctx.cwd)
            // Vale matches the `.vale.ini` section globs against the path as given, so invoke it
            // with repository-relative paths from the repository root.
            .map(file => relative(ctx.cwd, file).replaceAll("\\", "/"))
            .filter(file => /\.mdx?$/.test(file) && PROSE_DIRS.some(dir => file.startsWith(dir)));
        if (files.length === 0) return;

        // Vale is a workspace devDependency whose binary `mise run docs:prose` downloads; until
        // then the bin shim exists but exits with an error, so report nothing rather than noise.
        let binary = join(ctx.cwd, "node_modules", "@vvago", "vale", "native", "vale");
        if (!existsSync(binary)) return;

        let result = await pi.exec(
            join(ctx.cwd, "node_modules", ".bin", "vale"),
            ["--output=line", ...files],
            { cwd: ctx.cwd },
        );
        let output = stripVTControlCharacters(`${result.stdout}${result.stderr}`).trim();
        if (result.code === 0 && output === "") {
            return { additionalContext: `vale: no prose findings in ${files.join(", ")}` };
        }
        if (output === "") return;
        return { additionalContext: `vale:\n${output}` };
    });
}

// Only regular files inside the project qualify. Internal URLs such as `local://` and files an edit
// deleted fail the existence check rather than needing a rule of their own.
function editedFiles(event: ToolResultEvent, cwd: string): string[] {
    let candidates: (string | undefined)[] = [];
    if (event.toolName === "write" && !event.isError && typeof event.input.path === "string") {
        candidates.push(event.input.path);
    } else if (event.toolName === "edit") {
        // Custom tools cannot take a built-in name, so `edit` always carries the edit tool's details.
        let edit = event as EditToolResultEvent;
        // A failed batch can still have landed some of its files; the per-file results say which.
        if (!event.isError) candidates.push(edit.details?.path, edit.details?.move);
        for (let file of edit.details?.perFileResults ?? []) {
            if (!file.isError) candidates.push(file.path, file.move);
        }
    }

    let root = resolve(cwd);
    let files = candidates
        .filter(candidate => candidate !== undefined)
        .map(candidate => resolve(root, candidate))
        .filter(file => file.startsWith(root + sep) && existsSync(file) && statSync(file).isFile());
    return [...new Set(files)];
}
