import { describe, expect, it } from "vitest";
import {
  createWorkflowSnapshot,
  preview,
  recomputeWorkflowSnapshot,
  renderWorkflowLines,
  renderWorkflowText,
  type WorkflowSnapshot,
} from "./display.js";

function snapshot(overrides: Partial<WorkflowSnapshot>): WorkflowSnapshot {
  return recomputeWorkflowSnapshot({
    ...createWorkflowSnapshot({ name: "wf", description: "d" }),
    ...overrides,
  });
}

describe("createWorkflowSnapshot", () => {
  it("initializes empty collections and zeroed counters", () => {
    expect(createWorkflowSnapshot({ name: "inspect_repo", description: "Inspect" })).toEqual({
      name: "inspect_repo",
      description: "Inspect",
      phases: [],
      logs: [],
      agents: [],
      agentCount: 0,
      runningCount: 0,
      doneCount: 0,
      errorCount: 0,
    });
  });
});

describe("recomputeWorkflowSnapshot", () => {
  it("returns a new top-level object and derives counters", () => {
    const input: WorkflowSnapshot = {
      ...createWorkflowSnapshot({ name: "wf", description: "d" }),
      agents: [
        { id: 1, label: "a", prompt: "p", status: "done" },
        { id: 2, label: "b", prompt: "p", status: "running" },
        { id: 3, label: "c", prompt: "p", status: "error" },
        { id: 4, label: "d", prompt: "p", status: "queued" },
      ],
    };
    const next = recomputeWorkflowSnapshot(input);
    expect(next).not.toBe(input);
    expect(next.agentCount).toBe(4);
    expect(next.runningCount).toBe(1);
    expect(next.doneCount).toBe(1);
    expect(next.errorCount).toBe(1);
  });
});

describe("renderWorkflowText", () => {
  it("renders an empty snapshot with a running header and zero counts", () => {
    const text = renderWorkflowText(snapshot({}));
    expect(text).toContain("Workflow running");
    expect(text).toContain("◆ Workflow: wf (0/0 done)");
    expect(text).not.toContain("Unphased");
    expect(text).not.toContain("log:");
  });

  it("groups agents by runtime phase (brief central assertion)", () => {
    const central = recomputeWorkflowSnapshot({
      ...createWorkflowSnapshot({ name: "inspect_repo", description: "Inspect" }),
      phases: ["Scan"],
      currentPhase: "Scan",
      agents: [
        { id: 1, label: "repository inventory", phase: "Scan", prompt: "scan", status: "done" },
        { id: 2, label: "source modules", phase: "Scan", prompt: "inspect", status: "running" },
      ],
    });
    expect(renderWorkflowText(central)).toContain("Workflow running");
    expect(renderWorkflowText(central)).toContain("Scan 1/2 · 1 running");
  });

  it("uses a completed header for the final render", () => {
    const text = renderWorkflowText(
      snapshot({ agents: [{ id: 1, label: "a", prompt: "p", status: "done" }] }),
      true,
    );
    expect(text).toContain("Workflow completed");
    expect(text).not.toContain("Workflow running");
  });
});

describe("renderWorkflowLines", () => {
  it("groups agents without a phase under an Unphased section", () => {
    const lines = renderWorkflowLines(
      snapshot({
        agents: [
          { id: 1, label: "loose one", prompt: "p", status: "done" },
          { id: 2, label: "loose two", prompt: "p", status: "running" },
        ],
      }),
    );
    expect(lines).toContain("  Unphased");
    expect(lines).toContain("    #1 ✓ loose one");
    expect(lines).toContain("    #2 ● loose two");
  });

  it("renders a distinct icon for every status", () => {
    const lines = renderWorkflowLines(
      snapshot({
        agents: [
          { id: 1, label: "q", prompt: "p", status: "queued" },
          { id: 2, label: "r", prompt: "p", status: "running" },
          { id: 3, label: "d", prompt: "p", status: "done" },
          { id: 4, label: "e", prompt: "p", status: "error" },
          { id: 5, label: "s", prompt: "p", status: "skipped" },
        ],
      }),
    );
    expect(lines).toContain("    #1 ○ q");
    expect(lines).toContain("    #2 ● r");
    expect(lines).toContain("    #3 ✓ d");
    expect(lines).toContain("    #4 ✗ e");
    expect(lines).toContain("    #5 - s");
  });

  it("orders per-phase counters and prefers errors in the header", () => {
    const snap = snapshot({
      phases: ["Q"],
      agents: [
        { id: 1, label: "a", phase: "Q", prompt: "p", status: "done" },
        { id: 2, label: "b", phase: "Q", prompt: "p", status: "running" },
        { id: 3, label: "c", phase: "Q", prompt: "p", status: "error" },
        { id: 4, label: "d", phase: "Q", prompt: "p", status: "skipped" },
      ],
    });
    const lines = renderWorkflowLines(snap);
    expect(lines[0]).toBe("◆ Workflow: wf (1/4 done, 1 errors)");
    expect(lines.some((line) => line.includes("Q 1/4 · 1 running · 1 errors · 1 skipped"))).toBe(true);
  });

  it("renders a current phase that has no agents yet", () => {
    const lines = renderWorkflowLines(snapshot({ currentPhase: "Prep" }));
    expect(lines.some((line) => line.includes("Prep 0/0"))).toBe(true);
  });

  it("caps visible agents and notes how many earlier agents are hidden", () => {
    const snap = snapshot({
      phases: ["Fan"],
      agents: [1, 2, 3, 4, 5].map((id) => ({
        id,
        label: `agent ${id}`,
        phase: "Fan",
        prompt: "p",
        status: "done" as const,
      })),
    });
    const lines = renderWorkflowLines(snap, { maxAgents: 2 });
    expect(lines).toContain("    #4 ✓ agent 4");
    expect(lines).toContain("    #5 ✓ agent 5");
    expect(lines).not.toContain("    #1 ✓ agent 1");
    expect(lines).toContain("    … 3 earlier agents");
  });

  it("renders no phased agent rows when the agent cap is zero", () => {
    const snap = snapshot({
      phases: ["Fan"],
      currentPhase: "Fan",
      agents: [1, 2, 3].map((id) => ({
        id,
        label: `agent ${id}`,
        phase: "Fan",
        prompt: "p",
        status: "done" as const,
      })),
    });
    const lines = renderWorkflowLines(snap, { maxAgents: 0 });
    expect(lines[0]).toBe("◆ Workflow: wf (3/3 done)");
    expect(lines.some((line) => line.includes("Fan 3/3"))).toBe(true);
    expect(lines.some((line) => line.trimStart().startsWith("#"))).toBe(false);
    expect(lines).toContain("    … 3 earlier agents");
  });

  it("renders no unphased agent rows when the agent cap is zero", () => {
    const snap = snapshot({
      agents: [
        { id: 1, label: "loose one", prompt: "p", status: "done" },
        { id: 2, label: "loose two", prompt: "p", status: "running" },
      ],
    });
    const lines = renderWorkflowLines(snap, { maxAgents: 0 });
    expect(lines).toContain("  Unphased");
    expect(lines.some((line) => line.trimStart().startsWith("#"))).toBe(false);
  });

  it("renders no log lines when the log cap is zero", () => {
    const lines = renderWorkflowLines(snapshot({ logs: ["one", "two", "three"] }), { maxLogs: 0 });
    expect(lines.some((line) => line.includes("log:"))).toBe(false);
    expect(lines).toEqual(["◆ Workflow: wf (0/0 done)"]);
  });

  it("caps visible logs to the configured maximum", () => {
    const lines = renderWorkflowLines(snapshot({ logs: ["one", "two", "three"] }), { maxLogs: 1 });
    expect(lines).toContain("  log: three");
    expect(lines).not.toContain("  log: one");
    expect(lines).not.toContain("  log: two");
  });

  it("shows the two most recent logs by default", () => {
    const lines = renderWorkflowLines(snapshot({ logs: ["one", "two", "three"] }));
    expect(lines).toContain("  log: two");
    expect(lines).toContain("  log: three");
    expect(lines).not.toContain("  log: one");
  });

  it("normalizes whitespace and shortens long labels to 48 characters", () => {
    const lines = renderWorkflowLines(
      snapshot({
        agents: [
          { id: 1, label: "spaced   out\tlabel", prompt: "p", status: "done" },
          { id: 2, label: "x".repeat(60), prompt: "p", status: "done" },
        ],
      }),
    );
    expect(lines).toContain("    #1 ✓ spaced out label");
    const longLine = lines.find((line) => line.startsWith("    #2"));
    expect(longLine).toBe(`    #2 ✓ ${"x".repeat(47)}…`);
  });

  it("appends result previews only when enabled", () => {
    const snap = snapshot({
      agents: [{ id: 1, label: "a", prompt: "p", status: "done", resultPreview: "summary text" }],
    });
    expect(renderWorkflowLines(snap, { showResultPreviews: true })).toContain(
      "    #1 ✓ a — summary text",
    );
    expect(renderWorkflowLines(snap)).toContain("    #1 ✓ a");
    expect(renderWorkflowLines(snap)).not.toContain("summary text");
  });
});

describe("preview", () => {
  it("returns short strings unchanged", () => {
    expect(preview("short")).toBe("short");
  });

  it("truncates strings longer than the default max to an ellipsis", () => {
    const out = preview("y".repeat(100));
    expect(out).toHaveLength(80);
    expect(out).toBe(`${"y".repeat(79)}…`);
  });

  it("honors a custom max length", () => {
    expect(preview("z".repeat(20), 10)).toBe(`${"z".repeat(9)}…`);
  });

  it("serializes non-string values as JSON", () => {
    expect(preview({ a: 1, b: [2, 3] })).toBe('{"a":1,"b":[2,3]}');
  });

  it("returns an empty string for empty or undefined input", () => {
    expect(preview("")).toBe("");
    expect(preview(undefined)).toBe("");
  });
});
