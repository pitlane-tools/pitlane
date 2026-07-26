// Ported from pi-dynamic-workflows v1.0.1, commit 31b2aca0f1cb195aafbfc5e3ee2b8c83ad3f21a2.
// Pure display model only: Pi extension widget/status APIs are intentionally omitted.
import type { WorkflowMeta } from "./workflow.js";

export type WorkflowAgentStatus = "queued" | "running" | "done" | "error" | "skipped";

export interface WorkflowAgentSnapshot {
    id: number;
    label: string;
    phase?: string;
    prompt: string;
    status: WorkflowAgentStatus;
    resultPreview?: string;
    error?: string;
}

export interface WorkflowSnapshot {
    name: string;
    description?: string;
    phases: string[];
    currentPhase?: string;
    logs: string[];
    agents: WorkflowAgentSnapshot[];
    agentCount: number;
    runningCount: number;
    doneCount: number;
    errorCount: number;
    durationMs?: number;
    result?: unknown;
}

export interface WorkflowDisplayOptions {
    maxAgents?: number;
    maxLogs?: number;
    showResultPreviews?: boolean;
}

export function createWorkflowSnapshot(meta: WorkflowMeta): WorkflowSnapshot {
    return {
        name: meta.name,
        description: meta.description,
        phases: [],
        logs: [],
        agents: [],
        agentCount: 0,
        runningCount: 0,
        doneCount: 0,
        errorCount: 0,
    };
}

export function recomputeWorkflowSnapshot(snapshot: WorkflowSnapshot): WorkflowSnapshot {
    let runningCount = snapshot.agents.filter(agent => agent.status === "running").length;
    let doneCount = snapshot.agents.filter(agent => agent.status === "done").length;
    let errorCount = snapshot.agents.filter(agent => agent.status === "error").length;
    // Clone the collections and every agent row so a frame handed to a consumer is
    // a stable point-in-time copy: later pushes to logs/phases or in-place agent
    // status/error edits on the live snapshot never mutate an already-emitted frame.
    return {
        ...snapshot,
        phases: [...snapshot.phases],
        logs: [...snapshot.logs],
        agents: snapshot.agents.map(agent => ({ ...agent })),
        agentCount: snapshot.agents.length,
        runningCount,
        doneCount,
        errorCount,
    };
}

export function renderWorkflowLines(
    snapshot: WorkflowSnapshot,
    options: WorkflowDisplayOptions = {},
): string[] {
    let maxAgents = options.maxAgents ?? 8;
    let maxLogs = options.maxLogs ?? 2;
    let showResultPreviews = options.showResultPreviews ?? false;
    let state =
        snapshot.errorCount > 0
            ? `, ${snapshot.errorCount} errors`
            : snapshot.runningCount > 0
              ? `, ${snapshot.runningCount} running`
              : "";
    let lines = [
        `◆ Workflow: ${snapshot.name} (${snapshot.doneCount}/${snapshot.agentCount} done${state})`,
    ];

    let agentPhaseNames = snapshot.agents
        .map(agent => agent.phase)
        .filter((phase): phase is string => Boolean(phase));
    let phaseNames = [
        ...new Set([
            ...snapshot.phases,
            ...(snapshot.currentPhase ? [snapshot.currentPhase] : []),
            ...agentPhaseNames,
        ]),
    ];
    let rendered = new Set<WorkflowAgentSnapshot>();

    for (let phase of phaseNames) {
        let agents = snapshot.agents.filter(agent => agent.phase === phase);
        if (agents.length === 0 && snapshot.currentPhase !== phase) continue;
        for (let agent of agents) rendered.add(agent);
        let done = agents.filter(agent => agent.status === "done").length;
        let running = agents.filter(agent => agent.status === "running").length;
        let errors = agents.filter(agent => agent.status === "error").length;
        let skipped = agents.filter(agent => agent.status === "skipped").length;
        let complete = agents.length > 0 && done + errors + skipped === agents.length;
        let marker =
            running > 0 || (!complete && snapshot.currentPhase === phase)
                ? "▶"
                : complete
                  ? "✓"
                  : " ";
        lines.push(
            `  ${marker} ${phase} ${done}/${agents.length}${running ? ` · ${running} running` : ""}${errors ? ` · ${errors} errors` : ""}${skipped ? ` · ${skipped} skipped` : ""}`,
        );

        let visibleAgents = tail(agents, maxAgents);
        for (let agent of visibleAgents) {
            let order = `#${agent.id}`;
            let result =
                showResultPreviews && agent.resultPreview ? ` — ${agent.resultPreview}` : "";
            lines.push(
                `    ${order} ${STATUS_ICON[agent.status]} ${shorten(agent.label, 48)}${result}`,
            );
        }
        if (agents.length > visibleAgents.length)
            lines.push(`    … ${agents.length - visibleAgents.length} earlier agents`);
    }

    let unphased = snapshot.agents.filter(agent => !rendered.has(agent));
    if (unphased.length) {
        lines.push("  Unphased");
        for (let agent of tail(unphased, maxAgents)) {
            let result =
                showResultPreviews && agent.resultPreview ? ` — ${agent.resultPreview}` : "";
            lines.push(
                `    #${agent.id} ${STATUS_ICON[agent.status]} ${shorten(agent.label, 48)}${result}`,
            );
        }
    }

    let visibleLogs = tail(snapshot.logs, maxLogs);
    if (visibleLogs.length) {
        if (lines.length > 1) lines.push("");
        for (let log of visibleLogs) lines.push(`  log: ${log}`);
    }
    return lines;
}

export function renderWorkflowText(
    snapshot: WorkflowSnapshot,
    completed = false,
    options: WorkflowDisplayOptions = {},
): string {
    let header = completed ? "Workflow completed" : "Workflow running";
    return [header, ...renderWorkflowLines(snapshot, options)].join("\n");
}

const STATUS_ICON: Record<WorkflowAgentStatus, string> = {
    queued: "○",
    running: "●",
    done: "✓",
    error: "✗",
    skipped: "-",
};

function tail<T>(items: T[], count: number): T[] {
    return count > 0 ? items.slice(-count) : [];
}

function shorten(value: string, max: number): string {
    let text = value.replace(/\s+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function preview(value: unknown, max = 80): string {
    let text = typeof value === "string" ? value : JSON.stringify(value);
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
