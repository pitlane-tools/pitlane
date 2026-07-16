import { describe, expect, it } from "vitest";
import {
  parseWorkflowScript,
  runWorkflow,
  WorkflowAgentFailure,
  type WorkflowAgentOutcome,
  type WorkflowAgentRequest,
  type WorkflowAgentRunner,
} from "./workflow.js";

const header = `export const meta = {
  name: "inspect_repo",
  description: "Inspect repository modules",
  phases: [{ title: "Scan" }],
}`;

describe("parseWorkflowScript", () => {
  it("extracts literal metadata and removes only the first export", () => {
    const parsed = parseWorkflowScript(`${header}\nphase("Scan")\nreturn args`);
    expect(parsed.meta).toEqual({
      name: "inspect_repo",
      description: "Inspect repository modules",
      phases: [{ title: "Scan" }],
    });
    expect(parsed.body).toContain('phase("Scan")');
    expect(parsed.body).not.toContain("export const meta");
  });

  it("accepts returns nested in workflow-level control flow", () => {
    const parsed = parseWorkflowScript(`${header}\nif (args) {\n  return args;\n}`);
    expect(parsed.body).toContain("return args");
  });

  it("rejects returns nested in class static blocks", () => {
    expect(() => parseWorkflowScript(`${header}\nclass C { static { return; } }`)).toThrow(
      /return.*function body/i,
    );
  });

  it("rejects semantic errors other than the intentional top-level return", () => {
    expect(() => parseWorkflowScript(`${header}\nlet duplicate;\nlet duplicate;`)).toThrow(
      /already been declared/,
    );
  });

  it("does not suppress unrelated semantic errors when source contains TS1108", () => {
    expect(() =>
      parseWorkflowScript(`${header}\nconst TS1108 = 1; let duplicate; let duplicate;`),
    ).toThrow(/already been declared/);
  });

  it.each([
    ["missing export", `const meta = { name: "x", description: "y" }`],
    ["computed metadata", `export const meta = { ["name"]: "x", description: "y" }`],
    ["spread metadata", `export const meta = { ...x, name: "x", description: "y" }`],
    ["prototype key", `export const meta = { name: "x", description: "y", __proto__: {} }`],
    ["empty name", `export const meta = { name: "", description: "y" }`],
    ["empty description", `export const meta = { name: "x", description: "" }`],
    ["syntax error", `export const meta = { name: "x", description: }`],
    ["second export", `export const meta = { name: "x", description: "y" }; export const value = 1`],
  ])("rejects %s", (_label, script) => {
    expect(() => parseWorkflowScript(script)).toThrow();
  });

  it.each([
    "Date.now()",
    "new Date()",
    "Math.random()",
    'import("node:fs")',
    'require("node:fs")',
    'eval("1 + 1")',
  ])("rejects unavailable operation %s", expression => {
    expect(() => parseWorkflowScript(`${header}\n${expression}`)).toThrow(/unavailable|deterministic|import|require|eval/i);
  });
});

class FakeRunner implements WorkflowAgentRunner {
  readonly calls: WorkflowAgentRequest[] = [];

  constructor(private readonly values: Record<string, WorkflowAgentOutcome | Error>) {}

  async run(request: WorkflowAgentRequest): Promise<WorkflowAgentOutcome> {
    this.calls.push(request);
    const value = this.values[request.prompt];
    if (value instanceof Error) throw value;
    if (!value) throw new Error(`missing fake result for ${request.prompt}`);
    return value;
  }
}

describe("runWorkflow", () => {
  it("preserves parallel source order, records phases, forwards args, and sums exact tokens", async () => {
    const { promise: slowGate, resolve: releaseSlow } = Promise.withResolvers<void>();
    const completions: string[] = [];
    const calls: WorkflowAgentRequest[] = [];
    const runner: WorkflowAgentRunner = {
      async run(request) {
        calls.push(request);
        if (request.prompt === "slow") {
          await slowGate;
          completions.push("slow");
          return { value: "slow result", tokens: 11 };
        }
        completions.push("fast");
        releaseSlow(undefined);
        return { value: "fast result", tokens: 7 };
      },
    };
    const observedPhases: string[] = [];
    const logs: string[] = [];
    const script = `${header}
phase("Scan")
log("starting scan")
const values = await parallel([
  () => agent("slow", { label: "slow scan" }),
  () => agent("fast", { label: "fast scan" }),
])
phase("Synthesize")
return { values, input: args, cwd, processCwd: process.cwd() }
`;

    const result = await runWorkflow(parseWorkflowScript(script), {
      args: { target: "src" },
      cwd: "/tmp/workflow",
      runner,
      concurrency: 2,
      onLog: message => logs.push(message),
      onPhase: title => observedPhases.push(title),
    });

    expect(completions).toEqual(["fast", "slow"]);
    expect(result.result).toEqual({
      values: ["slow result", "fast result"],
      input: { target: "src" },
      cwd: "/tmp/workflow",
      processCwd: "/tmp/workflow",
    });
    expect(result.phases).toEqual(["Scan", "Synthesize"]);
    expect(observedPhases).toEqual(["Scan", "Synthesize"]);
    expect(result.logs).toEqual(["starting scan"]);
    expect(logs).toEqual(["starting scan"]);
    expect(result.agentCount).toBe(2);
    expect(result.tokens).toBe(18);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(calls.map(call => ({ prompt: call.prompt, label: call.label, phase: call.phase }))).toEqual([
      { prompt: "slow", label: "slow scan", phase: "Scan" },
      { prompt: "fast", label: "fast scan", phase: "Scan" },
    ]);
  });

  it("emits stable agent lifecycle and progress events", async () => {
    const controller = new AbortController();
    const events: unknown[] = [];
    const runner: WorkflowAgentRunner = {
      async run(request) {
        expect(request.signal).toBe(controller.signal);
        request.onProgress?.("halfway");
        return { value: { done: true }, tokens: 3 };
      },
    };
    const script = `${header}
phase("Scan")
return agent("inspect", {
  agent: "scout",
  model: ["fast", "fallback"],
  label: "repository scan",
  schema: { type: "object" },
})
`;

    const result = await runWorkflow(parseWorkflowScript(script), {
      cwd: "/tmp/workflow",
      runner,
      signal: controller.signal,
      onAgentStart: event => events.push(["start", event]),
      onAgentProgress: event => events.push(["progress", event]),
      onAgentEnd: event => events.push(["end", event]),
    });

    expect(result.result).toEqual({ done: true });
    expect(events).toEqual([
      [
        "start",
        { id: 1, label: "repository scan", phase: "Scan", prompt: "inspect" },
      ],
      [
        "progress",
        { id: 1, label: "repository scan", phase: "Scan", message: "halfway" },
      ],
      [
        "end",
        { id: 1, label: "repository scan", phase: "Scan", result: { done: true } },
      ],
    ]);
  });

  it("counts WorkflowAgentFailure tokens, logs once, and returns null for the branch", async () => {
    const runner = new FakeRunner({
      healthy: { value: "ok", tokens: 5 },
      broken: new WorkflowAgentFailure("boom", 17),
    });
    const endings: unknown[] = [];
    const script = `${header}
const values = await parallel([
  () => agent("healthy"),
  () => agent("broken", { label: "broken branch" }),
])
return {
  values,
  total: budget.total,
  spent: budget.spent(),
  remaining: budget.remaining(),
}
`;

    const result = await runWorkflow(parseWorkflowScript(script), {
      cwd: "/tmp/workflow",
      runner,
      tokenBudget: 25,
      onAgentEnd: event => endings.push(event),
    });

    expect(result.result).toEqual({
      values: ["ok", null],
      total: 25,
      spent: 22,
      remaining: 3,
    });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]).toContain("boom");
    expect(result.tokens).toBe(22);
    expect(endings).toContainEqual({
      id: 2,
      label: "broken branch",
      phase: undefined,
      error: "boom",
    });
  });

  it("completes a whole pipeline stage before the next and skips failed slots", async () => {
    const runner = new FakeRunner({
      "stage1:1": { value: 10, tokens: 1 },
      "stage1:2": new WorkflowAgentFailure("stage one failed", 2),
      "stage2:10:1:0": { value: 11, tokens: 3 },
    });
    const events: string[] = [];
    const script = `${header}
return pipeline(
  [1, 2],
  value => agent(\`stage1:\${value}\`, { label: \`stage1 \${value}\` }),
  (value, original, index) =>
    agent(\`stage2:\${value}:\${original}:\${index}\`, { label: \`stage2 \${original}\` }),
)
`;

    const result = await runWorkflow(parseWorkflowScript(script), {
      cwd: "/tmp/workflow",
      runner,
      onAgentStart: event => events.push(`start:${event.label}`),
      onAgentEnd: event => events.push(`end:${event.label}`),
    });

    expect(result.result).toEqual([11, null]);
    expect(runner.calls.map(call => call.prompt)).toEqual(["stage1:1", "stage1:2", "stage2:10:1:0"]);
    expect(events.indexOf("end:stage1 1")).toBeLessThan(events.indexOf("start:stage2 1"));
    expect(events.indexOf("end:stage1 2")).toBeLessThan(events.indexOf("start:stage2 1"));
    expect(result.tokens).toBe(6);
  });

  it("never exceeds configured concurrency", async () => {
    let active = 0;
    let maximum = 0;
    const runner: WorkflowAgentRunner = {
      async run(request) {
        active++;
        maximum = Math.max(maximum, active);
        await Promise.resolve();
        active--;
        return { value: request.prompt, tokens: 1 };
      },
    };
    const script = `${header}
return parallel([
  () => agent("one"),
  () => agent("two"),
  () => agent("three"),
  () => agent("four"),
  () => agent("five"),
])
`;

    const result = await runWorkflow(parseWorkflowScript(script), {
      cwd: "/tmp/workflow",
      runner,
      concurrency: 2,
    });

    expect(maximum).toBe(2);
    expect(result.result).toEqual(["one", "two", "three", "four", "five"]);
  });

  it("rejects with the canonical message when the shared signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const runner = new FakeRunner({ unreachable: { value: "no", tokens: 1 } });
    const program = parseWorkflowScript(`${header}\nreturn agent("unreachable")`);

    await expect(
      runWorkflow(program, {
        cwd: "/tmp/workflow",
        runner,
        signal: controller.signal,
      }),
    ).rejects.toThrow("Workflow was aborted");
    expect(runner.calls).toHaveLength(0);
  });

  it("drains started agents before propagating a workflow execution error", async () => {
    const { promise: runnerRelease, resolve: finishRunner } = Promise.withResolvers<void>();
    const { promise: agentEnded, resolve: markAgentEnded } = Promise.withResolvers<void>();
    const order: string[] = [];
    const runner: WorkflowAgentRunner = {
      async run() {
        order.push("runner started");
        await runnerRelease;
        order.push("runner finished");
        return { value: "late result", tokens: 4 };
      },
    };
    const program = parseWorkflowScript(`${header}
agent("slow")
throw new Error("boom")
`);
    const workflow = runWorkflow(program, {
      cwd: "/tmp/workflow",
      runner,
      onAgentEnd: () => {
        order.push("agent ended");
        markAgentEnded(undefined);
      },
    });
    const observedWorkflow = workflow.then(
      () => order.push("workflow resolved"),
      error => order.push(`workflow rejected: ${error instanceof Error ? error.message : String(error)}`),
    );

    await Promise.resolve();
    await Promise.resolve();
    finishRunner(undefined);
    await Promise.all([agentEnded, observedWorkflow]);

    expect(order).toEqual([
      "runner started",
      "runner finished",
      "agent ended",
      "workflow rejected: Error: boom",
    ]);
  });

  it("rejects workflows that invoke no agents", async () => {
    const program = parseWorkflowScript(`${header}\nreturn { static: true }`);

    await expect(
      runWorkflow(program, {
        cwd: "/tmp/workflow",
        runner: new FakeRunner({}),
      }),
    ).rejects.toThrow(/at least one agent/i);
  });

  it.each([
    ["function", `await agent("work")\nreturn () => "not cloneable"`],
    ["unawaited promise", `return { pending: agent("work") }`],
  ])("rejects a %s in the final result as non-cloneable", async (_label, body) => {
    const program = parseWorkflowScript(`${header}\n${body}`);

    await expect(
      runWorkflow(program, {
        cwd: "/tmp/workflow",
        runner: new FakeRunner({ work: { value: "done", tokens: 1 } }),
      }),
    ).rejects.toThrow(
      /^workflow result must be structured-cloneable; did you forget to await agent\(\), parallel\(\), or pipeline\(\)\?/,
    );
  });
});
