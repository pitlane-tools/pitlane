import type { CustomToolAPI, CustomToolContext, Theme } from "@oh-my-pi/pi-coding-agent";
import type { AgentDefinition, SingleResult } from "@oh-my-pi/pi-coding-agent/task";
import type { ExecutorOptions } from "@oh-my-pi/pi-coding-agent/task/executor";

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OmpWorkflowAgentDependencies } from "./agent.js";
import type { WorkflowSnapshot } from "./display.js";

// `agent.ts` (imported transitively by `index.ts`) eagerly imports OMP's `/task`
// and `/task/executor` entrypoints, which load `pi-natives` — impossible under
// vitest. Mock those seams so the factory keeps its production imports while the
// runner runs against injected doubles. The barrel mock also re-supplies the real
// `zod` (resolved from OMP's own dependency tree, since the barrel itself would
// load natives) and a faithful `Text` double, so the API double stays real where
// it matters: strict schema parsing and renderer text extraction.
let { built } = vi.hoisted(() => ({ built: { runners: 0 } }));

vi.mock("@oh-my-pi/pi-coding-agent", () => {
    let require = createRequire(import.meta.resolve("@oh-my-pi/pi-coding-agent"));
    let zod = require("zod/v4");
    class Text {
        #text: string;
        constructor(text = "") {
            this.#text = text;
        }
        getText(): string {
            return this.#text;
        }
    }
    return { getActiveSkills: () => [], zod, z: zod, Text };
});
vi.mock("@oh-my-pi/pi-coding-agent/task", () => ({
    AgentOutputManager: class {
        constructor(_getArtifactsDir: () => string | null) {
            built.runners += 1;
        }
        async allocate(id: string): Promise<string> {
            return id;
        }
    },
    discoverAgents: vi.fn(),
    getAgent: (agents: AgentDefinition[], name: string): AgentDefinition | undefined =>
        agents.find(agent => agent.name === name),
}));
vi.mock("@oh-my-pi/pi-coding-agent/task/executor", () => ({ runSubprocess: vi.fn() }));
vi.mock("@oh-my-pi/pi-coding-agent/tools/output-schema-validator", () => ({
    buildOutputValidator: () => ({}),
}));

import { Text as PiText, zod as piZod } from "@oh-my-pi/pi-coding-agent";

import CustomToolFactory, { createWorkflowTool } from "./index.js";

const TASK: AgentDefinition = {
    name: "task",
    description: "General worker",
    systemPrompt: "You do tasks.",
    source: "bundled",
};

function makeResult(overrides: Partial<SingleResult> = {}): SingleResult {
    return {
        index: 0,
        id: "Workflow1",
        agent: "task",
        agentSource: "bundled",
        task: "",
        exitCode: 0,
        output: "",
        stderr: "",
        truncated: false,
        durationMs: 0,
        tokens: 0,
        requests: 0,
        ...overrides,
    };
}

// The API double carries the real zod (strict-schema fidelity) and the faithful
// Text double; casting through unknown is the DI seam vitest cannot type.
let api = {
    cwd: "/repo",
    zod: piZod,
    pi: { Text: PiText },
} as unknown as CustomToolAPI;

let context = {
    sessionManager: { getArtifactsDir: () => null, getArtifactManager: () => null },
    modelRegistry: {},
    settings: { get: () => undefined },
} as unknown as CustomToolContext;

// renderCall/renderResult only read `fg`/`bold`; identity styling keeps the raw
// text observable through Text.getText().
let theme = {
    fg: (_color: string, text: string) => text,
    bold: (text: string) => text,
} as unknown as Theme;

function textOf(component: unknown): string {
    if (component && typeof component === "object" && "getText" in component) {
        let getText = component.getText;
        if (typeof getText === "function") {
            let value = getText.call(component);
            if (typeof value === "string") return value;
        }
    }
    throw new Error("component is not a Text");
}

function makeDeps(
    run: (options: ExecutorOptions) => Promise<SingleResult> = async () => makeResult(),
): Partial<OmpWorkflowAgentDependencies> {
    return {
        discoverAgents: async () => ({ agents: [TASK], projectAgentsDir: null }),
        getActiveSkills: () => [],
        runSubprocess: vi.fn(run),
    };
}

const META = `export const meta = {
  name: "metadata_scan",
  description: "Summarize repository metadata",
};`;

const TWO_AGENT = `${META}
phase("Scan");
const findings = await parallel([
  () => agent("scan packages", { label: "package scan" }),
  () => agent("scan configs", { label: "config scan" }),
]);
return { findings };`;

let validScript = `${META}
return await agent("inspect", { label: "inspect repo" });`;

async function runTool(
    script: string,
    deps: Partial<OmpWorkflowAgentDependencies>,
    signal?: AbortSignal,
) {
    let tool = createWorkflowTool(api, deps);
    let updates: Array<{
        content: Array<{ type: string; text?: string }>;
        details?: WorkflowSnapshot;
    }> = [];
    let result = await tool.execute(
        "call-1",
        { script },
        update => updates.push(update),
        context,
        signal,
    );
    return { result, updates };
}

beforeEach(() => {
    built.runners = 0;
});

describe("createWorkflowTool", () => {
    it("exposes an essential top-level workflow tool with a model-facing description", () => {
        let tool = createWorkflowTool(api);
        expect(tool.name).toBe("workflow");
        expect(tool.loadMode).toBe("essential");
        expect(tool.description).toMatch(/deterministic JavaScript workflow/);
        expect(tool.description).toMatch(/every agent needs a short unique label/);
        expect(tool.description).toMatch(/parallel receives zero-argument functions/);
    });

    it("validates parameters with a strict schema", () => {
        let tool = createWorkflowTool(api);
        expect(tool.parameters.safeParse({ script: validScript }).success).toBe(true);
        expect(tool.parameters.safeParse({ script: validScript, args: { a: 1 } }).success).toBe(
            true,
        );
        expect(tool.parameters.safeParse({}).success).toBe(false);
        expect(tool.parameters.safeParse({ script: 42 }).success).toBe(false);
        expect(tool.parameters.safeParse({ script: validScript, extra: true }).success).toBe(false);
    });

    it("streams running snapshots and preserves the final result of a two-agent workflow", async () => {
        let outputs: Record<string, string> = {
            "scan packages": "3 packages",
            "scan configs": "2 configs",
        };
        let deps = makeDeps(async options =>
            makeResult({ task: options.task, output: outputs[options.task] ?? "", tokens: 5 }),
        );

        let { result, updates } = await runTool(TWO_AGENT, deps);

        let partials = updates.map(update => update.content[0]?.text ?? "");
        expect(partials.some(text => text.startsWith("Workflow running"))).toBe(true);

        let finalText = result.content[0];
        expect(finalText.type).toBe("text");
        expect(finalText.type === "text" ? finalText.text : "").toContain("metadata_scan");

        let details = result.details as WorkflowSnapshot;
        expect(details.name).toBe("metadata_scan");
        expect(details.agents).toHaveLength(2);
        expect(details.agents.every(agent => agent.status === "done")).toBe(true);
        expect(details.doneCount).toBe(2);
        expect(details.result).toEqual({ findings: ["3 packages", "2 configs"] });
        // workflowResult augments the snapshot with the run's cumulative token total.
        let detailed = details as unknown as WorkflowSnapshot & { tokens: number };
        expect(detailed.tokens).toBe(10);
    });

    it("strips a single outer code fence before parsing", async () => {
        let fenced = ["```js", validScript, "```"].join("\n");
        let deps = makeDeps(async () => makeResult({ output: "done" }));

        let { result } = await runTool(fenced, deps);

        let details = result.details as WorkflowSnapshot;
        expect(details.name).toBe("metadata_scan");
        expect(details.agents).toHaveLength(1);
        expect(built.runners).toBe(1);
    });

    it("rejects a script with surrounding prose without constructing a runner", async () => {
        let withProse = [
            "Here is the workflow you asked for:",
            "```js",
            validScript,
            "```",
            "Enjoy!",
        ].join("\n");

        await expect(runTool(withProse, makeDeps())).rejects.toThrow(/prose/i);
        expect(built.runners).toBe(0);
    });

    it("rejects a workflow that never calls an agent", async () => {
        let noAgent = `${META}
phase("Idle");
return 42;`;

        await expect(runTool(noAgent, makeDeps())).rejects.toThrow(/at least one agent/i);
    });

    it("fails parsing before the runner is created", async () => {
        let brokenMeta = `export const meta = { name: "broken" };
return await agent("x", { label: "x" });`;

        await expect(runTool(brokenMeta, makeDeps())).rejects.toThrow();
        expect(built.runners).toBe(0);
    });

    it("marks an aborted in-flight agent skipped, clears its abort error, and resolves an error result", async () => {
        let controller = new AbortController();
        let started = Promise.withResolvers<void>();
        let deps = makeDeps(async () => {
            started.resolve();
            await new Promise<void>(() => {}); // never settles; the abort ends it
            return makeResult();
        });

        let tool = createWorkflowTool(api, deps);
        let updates: Array<{
            content: Array<{ type: string; text?: string }>;
            details?: WorkflowSnapshot;
        }> = [];
        let run = tool.execute(
            "call-1",
            { script: validScript },
            update => updates.push(update),
            context,
            controller.signal,
        );

        await started.promise;
        controller.abort();

        let result = await run;
        expect(result.isError).toBe(true);
        expect(result.content[0]).toEqual({ type: "text", text: "Workflow was aborted" });
        let rows = result.details?.agents ?? [];
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe("skipped");
        expect(rows[0]?.error).toBeUndefined();

        // The final streamed frame mirrors the resolved skipped snapshot.
        let last = updates.at(-1);
        expect(last?.content[0]?.text?.startsWith("Workflow completed")).toBe(true);
        expect(last?.details?.agents?.[0]?.status).toBe("skipped");
    });

    it("keeps a genuine branch failure as error while skipping the aborted branch", async () => {
        let controller = new AbortController();
        let hangStarted = Promise.withResolvers<void>();
        let deps = makeDeps(async options => {
            if (options.task === "hang") {
                hangStarted.resolve();
                await new Promise<void>(() => {}); // in-flight until abort
            }
            return makeResult({ task: options.task, exitCode: 1, error: "branch blew up" });
        });

        let script = `${META}
phase("Scan");
const failed = await agent("fail", { label: "failing agent" });
const hung = agent("hang", { label: "hanging agent" });
await hung;
return { failed, hung };`;

        let tool = createWorkflowTool(api, deps);
        let updates: Array<{
            content: Array<{ type: string; text?: string }>;
            details?: WorkflowSnapshot;
        }> = [];
        let run = tool.execute(
            "call-1",
            { script },
            update => updates.push(update),
            context,
            controller.signal,
        );

        await hangStarted.promise;
        controller.abort();

        let result = await run;
        expect(result.isError).toBe(true);
        let rows = result.details?.agents ?? [];
        let failRow = rows.find(row => row.label === "failing agent");
        let hangRow = rows.find(row => row.label === "hanging agent");
        expect(failRow?.status).toBe("error");
        expect(failRow?.error).toBe("branch blew up");
        expect(hangRow?.status).toBe("skipped");
        expect(hangRow?.error).toBeUndefined();
    });

    it("keeps a pre-abort failure that carries the exact abort message as error, not skipped", async () => {
        let controller = new AbortController();
        let hangStarted = Promise.withResolvers<void>();
        let deps = makeDeps(async options => {
            if (options.task === "hang") {
                hangStarted.resolve();
                await new Promise<void>(() => {}); // in-flight until abort
            }
            // The genuine failure carries the exact text an abort would produce; because
            // it lands before the signal aborts, it must stay error, not become skipped.
            return makeResult({ task: options.task, exitCode: 1, error: "Workflow was aborted" });
        });

        let script = `${META}
phase("Scan");
const failed = await agent("fail", { label: "failing agent" });
const hung = agent("hang", { label: "hanging agent" });
await hung;
return { failed, hung };`;

        let tool = createWorkflowTool(api, deps);
        let updates: Array<{
            content: Array<{ type: string; text?: string }>;
            details?: WorkflowSnapshot;
        }> = [];
        let run = tool.execute(
            "call-1",
            { script },
            update => updates.push(update),
            context,
            controller.signal,
        );

        await hangStarted.promise;
        controller.abort();

        let result = await run;
        expect(result.isError).toBe(true);
        let rows = result.details?.agents ?? [];
        let failRow = rows.find(row => row.label === "failing agent");
        let hangRow = rows.find(row => row.label === "hanging agent");
        expect(failRow?.status).toBe("error");
        expect(failRow?.error).toBe("Workflow was aborted");
        expect(hangRow?.status).toBe("skipped");
        expect(hangRow?.error).toBeUndefined();
    });

    it("renders the tool call title", () => {
        let tool = createWorkflowTool(api);
        let component = tool.renderCall?.(
            { script: validScript },
            { expanded: false, isPartial: false },
            theme,
        );
        expect(textOf(component)).toContain("workflow");
    });

    it("renders the workflow snapshot for results with details", () => {
        let tool = createWorkflowTool(api);
        let details: WorkflowSnapshot = {
            name: "demo",
            phases: [],
            logs: [],
            agents: [],
            agentCount: 0,
            runningCount: 0,
            doneCount: 0,
            errorCount: 0,
        };
        let finalView = tool.renderResult?.(
            { content: [], details },
            { expanded: false, isPartial: false },
            theme,
        );
        expect(textOf(finalView)).toContain("Workflow completed");
        expect(textOf(finalView)).toContain("demo");

        let partialView = tool.renderResult?.(
            { content: [], details },
            { expanded: false, isPartial: true },
            theme,
        );
        expect(textOf(partialView)).toContain("Workflow running");
    });

    it("renders the skipped snapshot and the abort line for an aborted error result", () => {
        let tool = createWorkflowTool(api);
        let details: WorkflowSnapshot = {
            name: "demo",
            phases: [],
            logs: [],
            agents: [{ id: 1, label: "inspect repo", prompt: "p", status: "skipped" }],
            agentCount: 1,
            runningCount: 0,
            doneCount: 0,
            errorCount: 0,
        };
        let view = tool.renderResult?.(
            { isError: true, content: [{ type: "text", text: "Workflow was aborted" }], details },
            { expanded: false, isPartial: false },
            theme,
        );
        let text = textOf(view);
        expect(text).toContain("Workflow completed");
        expect(text).toContain("demo");
        expect(text).toContain("inspect repo");
        expect(text).toContain("Workflow was aborted");
    });

    it("falls back to text content, then a muted label, when details are missing", () => {
        let tool = createWorkflowTool(api);
        let withText = tool.renderResult?.(
            { content: [{ type: "text", text: "raw summary" }] },
            { expanded: false, isPartial: false },
            theme,
        );
        expect(textOf(withText)).toBe("raw summary");

        let empty = tool.renderResult?.(
            { content: [] },
            { expanded: false, isPartial: false },
            theme,
        );
        expect(textOf(empty)).toBe("workflow");
    });

    it("discovers a default factory export", async () => {
        let resolved = await Promise.resolve(CustomToolFactory(api));
        let tool = Array.isArray(resolved) ? resolved[0] : resolved;
        expect(tool.name).toBe("workflow");
    });
});

describe("OMP custom-tool discovery (real loader boundary)", () => {
    // OMP's public `loadCustomTools` transitively pulls in the Bun runtime
    // (`import { YAML } from "bun"`, `bun:ffi`, native addons) through pi-utils and
    // the task executor — the same coupling the unit tests above mock away. Node's
    // vitest worker cannot evaluate that graph, so to exercise the *real* loader
    // against the *real* source path we run it in the runtime OMP actually uses
    // (Bun) and assert on its structured result. This is the genuine custom-tool
    // boundary, not a stubbed re-implementation of it.
    it("loads through OMP custom-tool discovery", () => {
        let toolPath = resolve(".omp/tools/dynamic-workflows/index.ts");
        let cwd = process.cwd();
        let script = [
            `import { loadCustomTools } from "@oh-my-pi/pi-coding-agent";`,
            `const loaded = await loadCustomTools(${JSON.stringify([{ path: toolPath }])}, ${JSON.stringify(cwd)}, []);`,
            `process.stdout.write(JSON.stringify({`,
            `  errors: loaded.errors,`,
            `  tools: loaded.tools.map(item => item.tool.name),`,
            `}));`,
        ].join("\n");

        let out = execFileSync("bun", ["-e", script], { cwd, encoding: "utf8" });
        let loaded = JSON.parse(out) as { errors: unknown[]; tools: string[] };

        expect(loaded.errors).toEqual([]);
        expect(loaded.tools).toContain("workflow");
    });
});
