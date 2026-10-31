import type { EditToolResultEvent, ExtensionAPI, ToolResultEvent } from "@oh-my-pi/pi-coding-agent";

import { existsSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { stripVTControlCharacters } from "node:util";

// The lifecycle wiring in AGENTS.md: every file the `edit` or `write` tool changes is formatted at
// once, so formatting never surfaces later as a failed gate the agent has to circle back for.
export default function formatAfterEdit(pi: ExtensionAPI): void {
    pi.on("tool_result", async (event, ctx) => {
        let files = editedFiles(event, ctx.cwd);
        if (files.length === 0) return;

        let before = files.map(file => readFileSync(file, "utf8"));
        let result = await pi.exec("mise", ["run", "fmt", "--", ...files], { cwd: ctx.cwd });
        let names = files.map(file => relative(ctx.cwd, file));
        if (result.code !== 0) {
            let output = stripVTControlCharacters(`${result.stdout}${result.stderr}`).trim();
            return {
                additionalContext: `\`mise run fmt\` failed on ${names.join(", ")}:\n${output}`,
            };
        }

        let reformatted = names.filter(
            (_, index) => readFileSync(files[index], "utf8") !== before[index],
        );
        if (reformatted.length === 0) return;
        // The edit's hashline anchors describe the file as it was before formatting.
        return {
            additionalContext: `\`mise run fmt\` reformatted ${reformatted.join(", ")}; re-read before editing again.`,
        };
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
