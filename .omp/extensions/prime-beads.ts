import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

import { stripVTControlCharacters } from "node:util";

// `bd prime` is a few hundred tokens in MCP mode and one to two thousand in CLI mode. The cap
// only guards against an unexpectedly large memory set.
const PRIME_LIMIT = 16_000;

// The lifecycle wiring in AGENTS.md: the work graph and the project's durable memories reach the
// agent before its first turn, so "what is ready?" never has to be asked. Injected once per
// session; a later `bd prime` is the agent's own call.
export default function primeBeads(pi: ExtensionAPI): void {
    let primed = false;

    pi.on("before_agent_start", async (_event, ctx) => {
        if (primed) return;
        primed = true;

        let result = await pi.exec("bd", ["prime"], { cwd: ctx.cwd });
        // No `bd`, no Beads workspace, or a Beads error: the session continues without it rather
        // than reporting a failure the agent cannot act on.
        if (result.code !== 0) return;

        let content = stripVTControlCharacters(result.stdout).trim();
        if (content === "") return;

        return {
            message: {
                customType: "agents.beads.prime",
                content: content.slice(0, PRIME_LIMIT),
                display: false,
                details: { command: "bd prime" },
            },
        };
    });
}
