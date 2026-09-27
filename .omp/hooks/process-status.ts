import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

// AGENTS.md opens with `vp run status`, because a session that does not know
// which phase the work is in guesses. A rule the agent has to remember is the
// weakest kind of rule, so this runs the command once per process and injects
// the answer before the first turn.
let reported = false;

export default function (pi: HookAPI): void {
    pi.on("before_agent_start", async (_event, ctx) => {
        if (reported) return;
        reported = true;

        let report: string;
        try {
            let result = (await pi.exec("vp", ["run", "status"], {
                cwd: ctx.cwd,
                // The task shells out to git and gh, so a wedged network call
                // would otherwise hold up the first turn indefinitely.
                timeout: 15_000,
            })) as { stdout?: string; stderr?: string; code?: number };
            // Vite+ opens stdout with its `$ node tools/status.ts` command echo,
            // which is not part of the report.
            let stdout = result.stdout?.replace(/^\$ .*\n/, "").trim();
            report = (stdout || result.stderr?.trim()) ?? "";
            if (result.code) report = `exited ${result.code}\n${report}`;
        } catch {
            // Vite+ is missing or the task timed out; AGENTS.md still names it.
            return;
        }
        if (report.length === 0) return;

        return {
            message: {
                customType: "process-status",
                content: `[vp run status]\n${report}`,
                display: true,
                attribution: "agent",
            },
        };
    });
}
