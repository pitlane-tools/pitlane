import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

import { existsSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

// Runs Vale after every successful edit/write that touches a prose file and
// appends the findings to the tool result, so the agent sees prose feedback
// in-context immediately. Keep the directory list in sync with .vale.ini.
const PROSE_DIRS = ["docs/package/", "docs/guides/"];

export default function (pi: HookAPI): void {
    pi.on("tool_result", async (event, ctx) => {
        if (event.isError) return;
        if (event.toolName !== "edit" && event.toolName !== "write") return;

        let prose = collectPaths(event.input, ctx.cwd).filter(path => {
            let rel = relative(ctx.cwd, path).replaceAll("\\", "/");
            return rel.endsWith(".md") && PROSE_DIRS.some(dir => rel.startsWith(dir));
        });
        prose = prose.filter(path => existsSync(path));
        if (prose.length === 0) return;

        // Vale matches .vale.ini section globs against the path as given, so
        // invoke with repo-relative paths from the repo root.
        let files = prose.map(path => relative(ctx.cwd, path).replaceAll("\\", "/"));

        let report: string;
        try {
            let result = (await pi.exec("vale", ["--output=line", ...files], {
                cwd: ctx.cwd,
            })) as { stdout?: string; stderr?: string; code?: number; exitCode?: number };
            let output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
            let code = result.code ?? result.exitCode ?? 0;
            report =
                code === 0 && output.length === 0
                    ? `no prose findings in ${files.join(", ")}`
                    : output;
        } catch {
            // Vale is not installed; the manual fallback in AGENTS.md applies.
            return;
        }

        return {
            content: [...event.content, { type: "text", text: `\n[vale]\n${report}` }],
        };
    });
}

/**
 * Pull file paths out of a tool call's input: `write` carries `path`, the
 * hashline `edit` tool carries a patch whose section headers look like
 * `[relative/path.md#1A2B]`.
 */
function collectPaths(input: Record<string, unknown>, cwd: string): string[] {
    let found = new Set<string>();
    if (typeof input.path === "string") found.add(input.path);
    if (typeof input.input === "string") {
        for (let match of input.input.matchAll(/^\[([^\]#\n]+)#[0-9A-Fa-f]{4}\]/gm)) {
            found.add(match[1]);
        }
    }
    return [...found].map(path => (isAbsolute(path) ? path : join(cwd, path)));
}
