import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

import { stripVTControlCharacters } from "node:util";

// `mise run check` prints every task's log; the cap keeps one failure from flooding the agent's
// context.
const REPORTED_LINES = 120;

// OMP stops waiting for an extension handler after 30 seconds and lets the stop through. Ending the
// gate first turns a slow run into a refusal the agent sees instead of a silent pass.
const GATE_TIMEOUT_MS = 25_000;

// The lifecycle wiring in AGENTS.md: before the agent ends its turn, the full gate runs, and a
// failure sends the agent back with the output instead of letting it report work that does not pass.
// A turn that changed nothing still pays for the gate, so the timeout below decides whether the
// gate or the agent reports the result.
export default function checkBeforeStop(pi: ExtensionAPI): void {
    pi.on("session_stop", async (event, ctx) => {
        // One refusal per stop, so a failure the agent cannot fix does not trap the session.
        if (event.stop_hook_active) return;

        let result = await pi.exec("mise", ["run", "check"], {
            cwd: ctx.cwd,
            signal: event.signal,
            timeout: GATE_TIMEOUT_MS,
        });
        if (result.code === 0 || event.signal.aborted) return;
        if (result.killed) {
            return {
                decision: "block",
                reason: `\`mise run check\` did not finish within ${GATE_TIMEOUT_MS / 1000} seconds. Run it yourself and read its result before finishing.`,
            };
        }

        let output = stripVTControlCharacters(`${result.stdout}${result.stderr}`)
            .trim()
            .split("\n")
            .slice(-REPORTED_LINES)
            .join("\n");
        return {
            decision: "block",
            reason: `\`mise run check\` failed. Fix it before finishing, or say why it cannot pass.\n\n${output}`,
        };
    });
}
