# OMP Dynamic Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repository-local OMP `workflow` tool that runs Claude-style JavaScript workflows through OMP agent profiles and the native task executor.

**Architecture:** A `CustomToolFactory` owns registration and snapshot streaming. A parser/runtime module validates OXC ASTs and evaluates the workflow language in a restricted VM, while an agent adapter maps `agent()` calls to OMP `runSubprocess()` calls. The upstream display model remains a separate pure module.

**Tech Stack:** TypeScript 7, Vitest 4, Zod 4 through `CustomToolAPI`, `oxc-parser` 0.140, Node `vm`, OMP custom tools and task executor.

## Global Constraints

- The tool discovery root is `.omp/tools/dynamic-workflows/index.ts`.
- Use `oxc-parser` version `^0.140.0`; do not add Acorn or TypeBox.
- Use OMP option names `{ agent, model, label, schema }`; do not preserve `agentType` or prompt-only isolation aliases.
- Workflow agents may use `read`, `bash`, `edit`, `write`, `grep`, `glob`, `lsp`, `ast_edit`, `eval`, `debug`, `browser`, `web_search`, plus the executor-injected `hub`.
- Clear every resolved agent profile's `spawns`; `task` and `workflow` must remain unavailable to child agents.
- Keep the tool input to required `script` and optional `args`.
- Use OMP token counts, output-schema validation, model settings, active skills, artifacts, progress, and cancellation.
- Preserve source attribution to upstream commit `31b2aca0f1cb195aafbfc5e3ee2b8c83ad3f21a2` in ported source files.
- Do not implement worktree isolation or persisted workflow runs.

## File responsibilities

- `.omp/tools/dynamic-workflows/workflow.ts`: workflow metadata types, OXC parser, deterministic AST checks, VM runtime, concurrency, token budget, and injectable agent-runner contract.
- `.omp/tools/dynamic-workflows/agent.ts`: OMP profile discovery, safe tool filtering, model precedence, skill resolution, artifact IDs, `runSubprocess()` invocation, and output normalization.
- `.omp/tools/dynamic-workflows/display.ts`: workflow snapshots, counters, previews, and pure text rendering.
- `.omp/tools/dynamic-workflows/index.ts`: `CustomToolFactory`, Zod schema, tool guidance, script normalization, progress wiring, cancellation rendering, and final result.
- `.omp/tools/dynamic-workflows/*.test.ts`: focused contracts for the module beside each test.
- `package.json`, `pnpm-lock.yaml`, `tsconfig.json`: direct parser dependency and TypeScript discovery.

---

### Task 1: OXC parser and project typing

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json:21-27`
- Create: `.omp/tools/dynamic-workflows/workflow.ts`
- Create: `.omp/tools/dynamic-workflows/workflow.test.ts`

**Interfaces:**
- Produces: `WorkflowMeta`, `WorkflowMetaPhase`, and `parseWorkflowScript(script): { meta: WorkflowMeta; body: string }`.
- Produces: internal `AstNode` traversal helpers used by Task 2 in the same module.

- [ ] **Step 1: Add the parser dependency and TypeScript include**

Run:

```bash
pnpm add -D oxc-parser@^0.140.0
```

Then add the tool glob after the hooks glob in `tsconfig.json`:

```json
"include": [
  "vite.config.ts",
  "docs/.vitepress/**/*.ts",
  "docs/.vitepress/**/*.vue",
  "docs/.vitepress/**/*.tsx",
  ".omp/hooks/*.ts",
  ".omp/tools/**/*.ts"
]
```

Expected: `package.json` contains `"oxc-parser": "^0.140.0"` and `pnpm-lock.yaml` contains the platform-independent package plus its optional native bindings.

- [ ] **Step 2: Write failing parser tests**

Create `workflow.test.ts` with a parser describe block covering the required contract:

```ts
import { describe, expect, it } from "vitest";
import { parseWorkflowScript } from "./workflow.js";

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
```

- [ ] **Step 3: Run the parser tests and confirm the missing-module failure**

Run:

```bash
pnpm exec vitest run .omp/tools/dynamic-workflows/workflow.test.ts
```

Expected: FAIL because `./workflow.js` does not exist.

- [ ] **Step 4: Implement the literal parser and deterministic AST walk**

Create `workflow.ts` with the attribution comment, imports, public metadata types, and these exact parser boundaries:

```ts
// Ported from pi-dynamic-workflows v1.0.1, commit 31b2aca0f1cb195aafbfc5e3ee2b8c83ad3f21a2.
import type { Program } from "oxc-parser";
import { parseSync } from "oxc-parser";

export interface WorkflowMetaPhase {
  title: string;
  detail?: string;
  model?: string;
}

export interface WorkflowMeta {
  name: string;
  description: string;
  whenToUse?: string;
  phases?: WorkflowMetaPhase[];
}

type AstNode = {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
};

export function parseWorkflowScript(script: string): { meta: WorkflowMeta; body: string } {
  const result = parseSync("workflow.js", script, {
    lang: "js",
    sourceType: "module",
    astType: "js",
    range: true,
    preserveParens: false,
    showSemanticErrors: true,
  });
  const fatal = result.errors.find(error => error.severity === "Error");
  if (fatal) throw new Error(fatal.codeframe ?? fatal.message);

  const program = result.program as Program & AstNode;
  const first = program.body[0] as unknown as AstNode | undefined;
  if (first?.type !== "ExportNamedDeclaration") {
    throw new Error("`export const meta = { name, description }` must be the first statement");
  }
  assertAvailableAst(program, first);
  const declaration = first.declaration as AstNode | null;
  if (declaration?.type !== "VariableDeclaration" || declaration.kind !== "const") {
    throw new Error("meta export must be `export const meta = ...`");
  }
  const declarations = declaration.declarations as AstNode[];
  if (declarations.length !== 1) throw new Error("meta export must declare only `meta`");
  const declarator = declarations[0];
  const id = declarator.id as AstNode;
  if (id.type !== "Identifier" || id.name !== "meta") throw new Error("meta export must declare `meta`");
  const meta = evaluateLiteral(declarator.init as AstNode, "meta");
  validateMeta(meta);
  return { meta, body: script.slice(0, first.start) + script.slice(first.end) };
}
```

Implement `evaluateLiteral()` with explicit cases for `ObjectExpression`, `ArrayExpression`, `Literal`, `TemplateLiteral`, and negative numeric `UnaryExpression`. Reject `SpreadElement`, computed properties, methods, accessors, sparse elements, `__proto__`, `constructor`, and `prototype`. Implement `validateMeta()` to require trimmed strings for `name` and `description`, a string `whenToUse`, and phase objects with non-empty title strings.

Implement `assertAvailableAst(program, allowedMetaExport)` as a recursive property walk. Skip the exact first metadata export node, then reject every other import or export node, `ImportExpression`, `MetaProperty`, `new Date`, and calls to `Date.now`, `Math.random`, `require`, or `eval`. Skip scalar `start`, `end`, and `range` fields. Use `isAstNode(value)` to recurse only into objects with a string `type` field.

- [ ] **Step 5: Run parser tests and TypeScript**

Run:

```bash
pnpm exec vitest run .omp/tools/dynamic-workflows/workflow.test.ts
pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: parser tests PASS and TypeScript reports no errors.

- [ ] **Step 6: Commit the parser slice**

```bash
git add package.json pnpm-lock.yaml tsconfig.json .omp/tools/dynamic-workflows/workflow.ts .omp/tools/dynamic-workflows/workflow.test.ts
git commit -m "Add OXC workflow parser"
```

---

### Task 2: Deterministic workflow runtime

**Files:**
- Modify: `.omp/tools/dynamic-workflows/workflow.ts`
- Modify: `.omp/tools/dynamic-workflows/workflow.test.ts`

**Interfaces:**
- Consumes: `parseWorkflowScript()` from Task 1.
- Produces: `WorkflowAgentRequest`, `WorkflowAgentOutcome`, `WorkflowAgentRunner`, `WorkflowAgentFailure`, `WorkflowRunOptions`, `WorkflowRunResult`, and `runWorkflow(program, options)`, where `program` is the object returned by `parseWorkflowScript()`.
- Produces: `onAgentStart({ id, label, phase, prompt })`, `onAgentProgress({ id, label, phase, message })`, and `onAgentEnd({ id, label, phase, result, error })` events, plus `onLog(message)` and `onPhase(title)`, for Task 5.

- [ ] **Step 1: Add failing runtime tests with an injected runner**

Append tests built around this deterministic double:

```ts
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
```

Add separate tests that prove:

```ts
const script = `${header}
phase("Scan")
const values = await parallel([
  () => agent("slow", { label: "slow scan" }),
  () => agent("fast", { label: "fast scan" }),
])
phase("Synthesize")
return { values, input: args }
`;
```

- parallel results remain in source order;
- runtime phases are `Scan`, then `Synthesize`;
- `args` reaches the returned value;
- token usage is the sum of both outcomes;
- a `WorkflowAgentFailure("boom", 17)` logs once, contributes 17 spent tokens, and returns `null` for that branch;
- `pipeline([1, 2], stage1, stage2)` completes all `stage1` events before the first `stage2` event;
- more than the configured concurrency never runs at once;
- an aborted signal rejects with `Workflow was aborted`;
- a zero-agent script fails;
- returning a function or unawaited promise fails the structured-clone check.

- [ ] **Step 2: Run the runtime tests and confirm missing exports**

Run:

```bash
pnpm exec vitest run .omp/tools/dynamic-workflows/workflow.test.ts
```

Expected: FAIL because the runtime interfaces and `runWorkflow` are not exported. Every runtime test passes `parseWorkflowScript(script)` as the first argument.

- [ ] **Step 3: Add runner contracts and exact token-aware failures**

Add these interfaces above `runWorkflow`:

```ts
export interface WorkflowAgentRequest {
  prompt: string;
  agent: string;
  model?: string | string[];
  label: string;
  schema?: unknown;
  phase?: string;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

export interface WorkflowAgentOutcome {
  value: unknown;
  tokens: number;
}

export interface WorkflowAgentRunner {
  run(request: WorkflowAgentRequest): Promise<WorkflowAgentOutcome>;
}

export class WorkflowAgentFailure extends Error {
  constructor(message: string, readonly tokens: number) {
    super(message);
    this.name = "WorkflowAgentFailure";
  }
}
```

Define `WorkflowRunOptions` with `cwd`, `args`, required `runner`, optional `concurrency`, `tokenBudget`, `signal`, and the five callbacks named in Interfaces. Use numeric `id` and optional string `phase` consistently in all agent events. `onAgentEnd` carries either `result` or `error`. Define `WorkflowRunResult` with `meta`, `result`, `logs`, `phases`, `agentCount`, `tokens`, and `durationMs`.
`runWorkflow()` accepts the parsed `{ meta, body }` object rather than reparsing source. The custom tool and tests must call `parseWorkflowScript()` exactly once per invocation.

- [ ] **Step 4: Implement the VM runtime**
Add `import vm from "node:vm";` at the top of `workflow.ts`.

Implement `runWorkflow()` with one state object and one limiter. Use this sandbox construction:

```ts
const safeMath = Object.freeze(
  Object.fromEntries(
    Object.getOwnPropertyNames(Math)
      .filter(name => name !== "random")
      .map(name => [name, Object.getOwnPropertyDescriptor(Math, name)?.value]),
  ),
);

const context = vm.createContext(
  {
    agent,
    parallel,
    pipeline,
    phase,
    log,
    args: options.args,
    cwd,
    process: Object.freeze({ cwd: () => cwd }),
    budget,
    JSON,
    Math: safeMath,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Set,
    Map,
    Promise,
    Date: undefined,
    eval: undefined,
    Function: undefined,
  },
  { codeGeneration: { strings: false, wasm: false } },
);
```

`agent()` must validate prompt/options, allocate a stable numeric ID before entering the limiter, emit start/progress/end callbacks, record `outcome.tokens`, and return `outcome.value`. On `WorkflowAgentFailure`, add its tokens before logging and returning `null`. Re-throw whenever the shared signal is aborted.

Implement `parallel()` as `Promise.all()` over validated thunks, preserving input order. Implement `pipeline()` as a stage barrier: retain `{ original, value, failed }` slots, map one whole stage concurrently, then continue to the next stage. Failed slots keep `value: null` and skip later stages.

After `vm.Script(...).runInContext(context)`, await the tracked agent promises, require `agentCount > 0`, and call `structuredClone(result)`. Convert clone failures to the explicit unawaited-helper message from the design.

- [ ] **Step 5: Run focused runtime tests**

Run:

```bash
pnpm exec vitest run .omp/tools/dynamic-workflows/workflow.test.ts
```

Expected: all parser and runtime tests PASS.

- [ ] **Step 6: Commit the runtime slice**

```bash
git add .omp/tools/dynamic-workflows/workflow.ts .omp/tools/dynamic-workflows/workflow.test.ts
git commit -m "Add deterministic workflow runtime"
```

---

### Task 3: Snapshot and progress renderer

**Files:**
- Create: `.omp/tools/dynamic-workflows/display.ts`
- Create: `.omp/tools/dynamic-workflows/display.test.ts`

**Interfaces:**
- Consumes: `WorkflowMeta` from `workflow.ts`.
- Produces: `WorkflowSnapshot`, `WorkflowAgentSnapshot`, `createWorkflowSnapshot()`, `recomputeWorkflowSnapshot()`, `renderWorkflowText()`, and `preview()` for Task 5.

- [ ] **Step 1: Write failing renderer tests**

Create `display.test.ts` with tests for an empty snapshot, phase grouping, unphased rows, running/error/skipped counters, row limits, log limits, final header, and preview truncation. Use this central assertion:

```ts
const snapshot = recomputeWorkflowSnapshot({
  ...createWorkflowSnapshot({ name: "inspect_repo", description: "Inspect" }),
  phases: ["Scan"],
  currentPhase: "Scan",
  agents: [
    { id: 1, label: "repository inventory", phase: "Scan", prompt: "scan", status: "done" },
    { id: 2, label: "source modules", phase: "Scan", prompt: "inspect", status: "running" },
  ],
});
expect(renderWorkflowText(snapshot)).toContain("Workflow running");
expect(renderWorkflowText(snapshot)).toContain("Scan 1/2 · 1 running");
```

- [ ] **Step 2: Run the renderer tests and confirm the missing-module failure**

```bash
pnpm exec vitest run .omp/tools/dynamic-workflows/display.test.ts
```

Expected: FAIL because `display.ts` does not exist.

- [ ] **Step 3: Port the pure display model**

Port upstream `src/display.ts` without Pi extension widget APIs. Keep these status values:

```ts
export type WorkflowAgentStatus = "queued" | "running" | "done" | "error" | "skipped";
```

`recomputeWorkflowSnapshot()` must return a new top-level snapshot and derive `agentCount`, `runningCount`, `doneCount`, and `errorCount`. `renderWorkflowText()` must use `Workflow running` for partial output and `Workflow completed` for final output. Keep phase grouping, `#<id>` ordering, status icons, maximum visible agents/logs, whitespace normalization, and 80-character previews.

Do not import OMP TUI classes in this module. Task 5 wraps the returned string in OMP's injected `Text` class.

- [ ] **Step 4: Run renderer tests**

```bash
pnpm exec vitest run .omp/tools/dynamic-workflows/display.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the display slice**

```bash
git add .omp/tools/dynamic-workflows/display.ts .omp/tools/dynamic-workflows/display.test.ts
git commit -m "Add workflow progress renderer"
```

---

### Task 4: OMP task-executor adapter

**Files:**
- Create: `.omp/tools/dynamic-workflows/agent.ts`
- Create: `.omp/tools/dynamic-workflows/agent.test.ts`

**Interfaces:**
- Consumes: `WorkflowAgentRequest`, `WorkflowAgentOutcome`, `WorkflowAgentRunner`, and `WorkflowAgentFailure` from `workflow.ts`.
- Produces: `OmpWorkflowAgent` implementing `WorkflowAgentRunner`.
- Produces: dependency-injection type `OmpWorkflowAgentDependencies` for tests and Task 5.

- [ ] **Step 1: Write failing adapter tests**

Use injected `discoverAgents`, `getActiveSkills`, and `runSubprocess` functions. Build minimal `CustomToolContext` and `AgentDefinition` doubles with typed casts only at the test boundary.

Tests must assert the exact executor call:

```ts
expect(runSubprocess).toHaveBeenCalledWith(expect.objectContaining({
  agent: expect.objectContaining({
    name: "reviewer",
    spawns: undefined,
    tools: ["read", "grep", "lsp"],
  }),
  outputSchema: schema,
  keepAlive: false,
  modelOverride: ["openai/gpt-5.6"],
}));
```

Add cases for default `task`, unknown profile, disabled profile, settings model override, explicit model precedence, autoload-skill resolution, artifact-safe sequential IDs, text output, parsed schema output, malformed structured JSON, nonzero exit with tokens, progress forwarding, and signal cancellation.

- [ ] **Step 2: Run the adapter tests and confirm the missing-module failure**

```bash
pnpm exec vitest run .omp/tools/dynamic-workflows/agent.test.ts
```

Expected: FAIL because `agent.ts` does not exist.

- [ ] **Step 3: Implement profile resolution and safe filtering**

Create `agent.ts` with these imports and constants:

```ts
import type { CustomToolContext } from "@oh-my-pi/pi-coding-agent";
import { getActiveSkills } from "@oh-my-pi/pi-coding-agent";
import {
  AgentOutputManager,
  discoverAgents,
  getAgent,
  type AgentDefinition,
} from "@oh-my-pi/pi-coding-agent/task";
import { runSubprocess } from "@oh-my-pi/pi-coding-agent/task/executor";
import {
  WorkflowAgentFailure,
  type WorkflowAgentOutcome,
  type WorkflowAgentRequest,
  type WorkflowAgentRunner,
} from "./workflow.js";

const SAFE_TOOLS = [
  "read", "bash", "edit", "write", "grep", "glob",
  "lsp", "ast_edit", "eval", "debug", "browser", "web_search",
] as const;
```

Define dependencies with production defaults so tests can replace only the host calls. The constructor is `new OmpWorkflowAgent(cwd, context, parentToolCallId, dependencies?)`. Construct one `AgentOutputManager` per instance from `context.sessionManager.getArtifactsDir()`.

Resolve the profile named by `request.agent`. Read `task.disabledAgents` and `task.agentModelOverrides` from optional settings. Clone the profile, set `spawns: undefined`, and choose tools as the full allowlist when `profile.tools` is absent or the allowlist intersection when it is present.

- [ ] **Step 4: Implement native execution and normalized outcomes**

Allocate IDs as `Workflow1`, `Workflow2`, and so on. Pass the human label separately as `description`. Resolve active skills and profile autoload names before calling the executor.

Use these precedence and result rules:

```ts
const settingsModels = context.settings?.get("task.agentModelOverrides") ?? {};
const modelOverride = request.model ?? settingsModels[profile.name];
const result = await dependencies.runSubprocess({
  cwd,
  agent: safeProfile,
  task: request.prompt,
  assignment: request.prompt,
  description: request.label,
  parentToolCallId,
  index,
  id,
  modelOverride,
  outputSchema: request.schema,
  signal: request.signal,
  onProgress: progress => request.onProgress?.(progress.lastIntent ?? progress.currentTool ?? progress.status),
  modelRegistry: context.modelRegistry,
  settings: context.settings,
  skills: [...activeSkills],
  autoloadSkills,
  localProtocolOptions: context.localProtocolOptions,
  parentArtifactManager: context.sessionManager.getArtifactManager() ?? undefined,
  artifactsDir: context.sessionManager.getArtifactsDir() ?? undefined,
  keepAlive: false,
});
```

If the shared signal aborted, throw `new Error("Workflow was aborted")`. If `exitCode !== 0` or `result.aborted`, throw `WorkflowAgentFailure(message, result.tokens)`. For schema output, parse `result.output` and wrap JSON errors in `WorkflowAgentFailure` with the same token count. Return `{ value, tokens: result.tokens }`.

- [ ] **Step 5: Run adapter tests and TypeScript**

```bash
pnpm exec vitest run .omp/tools/dynamic-workflows/agent.test.ts
pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: adapter tests PASS and TypeScript reports no errors.

- [ ] **Step 6: Commit the adapter slice**

```bash
git add .omp/tools/dynamic-workflows/agent.ts .omp/tools/dynamic-workflows/agent.test.ts
git commit -m "Run workflows with OMP subagents"
```

---

### Task 5: OMP custom-tool factory

**Files:**
- Create: `.omp/tools/dynamic-workflows/index.ts`
- Create: `.omp/tools/dynamic-workflows/index.test.ts`

**Interfaces:**
- Consumes: all public interfaces from `workflow.ts`, `agent.ts`, and `display.ts`.
- Produces: default `CustomToolFactory` discovered by OMP.
- Produces: named `createWorkflowTool(api, dependencies?)` for factory-level tests.

- [ ] **Step 1: Write failing factory tests**

Build a minimal `CustomToolAPI` double with real `zod` and `Text` from `@oh-my-pi/pi-coding-agent`. Inject a runner factory so no model call occurs.

Assert:

```ts
expect(tool.name).toBe("workflow");
expect(tool.loadMode).toBe("essential");
expect(tool.parameters.safeParse({ script: validScript }).success).toBe(true);
expect(tool.parameters.safeParse({}).success).toBe(false);
expect(tool.parameters.safeParse({ script: validScript, extra: true }).success).toBe(false);
```

Execute a two-agent workflow and assert partial updates contain `Workflow running`, final content names the metadata workflow, final `details` has two done agents, and the result value is preserved. Add tests for outer-fence stripping, surrounding-prose rejection, zero-agent rejection, parser failure before runner creation, and abort rows becoming skipped.

- [ ] **Step 2: Run factory tests and confirm the missing-module failure**

```bash
pnpm exec vitest run .omp/tools/dynamic-workflows/index.test.ts
```

Expected: FAIL because `index.ts` does not exist.

- [ ] **Step 3: Implement the strict custom-tool schema and guidance**

Create `index.ts` with:

```ts
import type {
  CustomTool,
  CustomToolAPI,
  CustomToolFactory,
} from "@oh-my-pi/pi-coding-agent";
import { OmpWorkflowAgent, type OmpWorkflowAgentDependencies } from "./agent.js";
import {
  createWorkflowSnapshot,
  preview,
  recomputeWorkflowSnapshot,
  renderWorkflowText,
  type WorkflowSnapshot,
} from "./display.js";
import { parseWorkflowScript, runWorkflow, type WorkflowRunResult } from "./workflow.js";

const WORKFLOW_DESCRIPTION = [
  "Execute a deterministic JavaScript workflow that orchestrates OMP subagents.",
  "The first statement must export literal meta with non-empty name and description.",
  "Globals: agent, parallel, pipeline, phase, log, args, cwd, process.cwd, and budget.",
  "parallel receives zero-argument functions, not promises.",
  "agent options are agent, model, label, and schema; every agent needs a short unique label.",
  "Failed branches return null unless the workflow is aborted.",
  "Use a final synthesis agent when several branches feed one conclusion.",
].join(" ");

function createParameters(api: CustomToolAPI) {
  return api.zod.object({
    script: api.zod.string().describe("Raw JavaScript workflow script without prose."),
    args: api.zod.unknown().optional(),
  }).strict();
}
```

Use `WORKFLOW_DESCRIPTION` and `createParameters(api)` in the complete factory added in Step 4. `CustomTool` has no Pi `promptSnippet` or `promptGuidelines` fields, so every model-facing rule belongs in the description.

- [ ] **Step 4: Implement snapshot streaming, cancellation, and rendering**

Add the factory with this execution shape:

```ts
export function createWorkflowTool(
  api: CustomToolAPI,
  dependencies?: Partial<OmpWorkflowAgentDependencies>,
): CustomTool<any, WorkflowSnapshot> {
  return {
    name: "workflow",
    label: "Workflow",
    loadMode: "essential",
    description: WORKFLOW_DESCRIPTION,
    parameters: createParameters(api),
    async execute(toolCallId, params, onUpdate, context, signal) {
      const program = parseWorkflowScript(normalizeWorkflowScript(params.script));
      let snapshot = createWorkflowSnapshot(program.meta);
      const emit = (complete = false) => {
        snapshot = recomputeWorkflowSnapshot(snapshot);
        onUpdate?.({
          content: [{ type: "text", text: renderWorkflowText(snapshot, complete) }],
          details: snapshot,
        });
      };
      const runner = new OmpWorkflowAgent(api.cwd, context, toolCallId, dependencies);

      try {
        const result = await runWorkflow(program, {
          cwd: api.cwd,
          args: params.args,
          runner,
          signal,
          onLog(message) {
            snapshot.logs.push(message);
            emit();
          },
          onPhase(title) {
            snapshot.currentPhase = title;
            if (!snapshot.phases.includes(title)) snapshot.phases.push(title);
            emit();
          },
          onAgentStart(event) {
            snapshot.agents.push({
              id: event.id,
              label: event.label,
              phase: event.phase,
              prompt: event.prompt,
              status: "running",
            });
            emit();
          },
          onAgentProgress() {
            emit();
          },
          onAgentEnd(event) {
            const row = snapshot.agents.find(agent => agent.id === event.id);
            if (row) {
              row.status = event.error ? "error" : "done";
              if (!event.error) row.resultPreview = preview(event.result);
            }
            emit();
          },
        });

        snapshot.result = result.result;
        snapshot.durationMs = result.durationMs;
        emit(true);
        return workflowResult(snapshot, result);
      } catch (error) {
        if (signal?.aborted || /abort(?:ed)?/i.test(error instanceof Error ? error.message : String(error))) {
          for (const row of snapshot.agents) {
            if (row.status === "running") row.status = "skipped";
          }
          emit(true);
          throw new Error("Workflow was aborted");
        }
        throw error;
      }
    },
    renderCall(_args, _options, theme) {
      return new api.pi.Text(theme.fg("toolTitle", theme.bold("workflow")), 0, 0);
    },
    renderResult(result, { isPartial }, theme) {
      const details = result.details as WorkflowSnapshot | undefined;
      if (details?.name) return new api.pi.Text(renderWorkflowText(details, !isPartial), 0, 0);
      const first = result.content[0];
      return new api.pi.Text(first?.type === "text" ? first.text : theme.fg("muted", "workflow"), 0, 0);
    },
  };
}

const factory: CustomToolFactory = api => createWorkflowTool(api);
export default factory;
```

Implement `normalizeWorkflowScript()` with the single-fence regular expression from the design. Implement typed `workflowResult()` with the exact return object below so the execute body stays focused on state transitions.
Normalize one outer fence, parse before constructing the runner, initialize `WorkflowSnapshot`, and call `runWorkflow()`. Wire callbacks as follows:

- `onLog` appends one log and emits a recomputed partial snapshot.
- `onPhase` sets `currentPhase`, inserts a unique phase, and emits.
- `onAgentStart` appends a running row with sequential display ID.
- `onAgentProgress` emits without storing unbounded subagent output.
- `onAgentEnd` finds the latest matching running row, sets done/error, and stores `preview(result)`.

On abort, mark every running row skipped, emit a completed frame, and throw `Workflow was aborted`. Reject workflows with zero agents through `runWorkflow()`.

Add this result helper:

```ts
function workflowResult(
  snapshot: WorkflowSnapshot,
  result: WorkflowRunResult,
) {
  return {
    content: [{
      type: "text" as const,
      text: `Workflow ${result.meta.name} completed with ${result.agentCount} agent(s).\n\nResult:\n${JSON.stringify(result.result, null, 2)}`,
    }],
    details: {
      ...snapshot,
      meta: result.meta,
      phases: result.phases,
      logs: result.logs,
      result: result.result,
      durationMs: result.durationMs,
      tokens: result.tokens,
    },
  };
}
```

Add `renderCall` and `renderResult` with `new api.pi.Text(...)`. The partial renderer calls `renderWorkflowText(snapshot, false)`; the final renderer passes `true`; missing details fall back to the first text content or `workflow`.

- [ ] **Step 5: Run all focused tests**

```bash
pnpm exec vitest run .omp/tools/dynamic-workflows
```

Expected: parser/runtime, display, adapter, and factory tests PASS.

- [ ] **Step 6: Commit the custom-tool slice**

```bash
git add .omp/tools/dynamic-workflows/index.ts .omp/tools/dynamic-workflows/index.test.ts
git commit -m "Register OMP workflow tool"
```

---

### Task 6: Loader and end-to-end verification

**Files:**
- Modify: `.omp/tools/dynamic-workflows/index.test.ts`
- Modify only if verification finds a real defect: `.omp/tools/dynamic-workflows/index.ts`, `.omp/tools/dynamic-workflows/agent.ts`, `.omp/tools/dynamic-workflows/display.ts`, `.omp/tools/dynamic-workflows/workflow.ts`

**Interfaces:**
- Consumes: the completed discovery entrypoint.
- Produces: proof that OMP loads and runs the tool through its real custom-tool boundary.

- [ ] **Step 1: Add a custom-tool loader integration test**

Use OMP's public loader against the real source path:

```ts
import { resolve } from "node:path";
import { loadCustomTools } from "@oh-my-pi/pi-coding-agent";

it("loads through OMP custom-tool discovery", async () => {
  const path = resolve(".omp/tools/dynamic-workflows/index.ts");
  const loaded = await loadCustomTools([{ path }], process.cwd(), []);
  expect(loaded.errors).toEqual([]);
  expect(loaded.tools.map(item => item.tool.name)).toContain("workflow");
});
```

- [ ] **Step 2: Run the loader test, focused suite, and typecheck**

```bash
pnpm exec vitest run .omp/tools/dynamic-workflows/index.test.ts
pnpm exec vitest run .omp/tools/dynamic-workflows
pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: all commands exit 0.

- [ ] **Step 3: Run a real loaded workflow smoke test**

Run OMP from the repository so project tool discovery finds `.omp/tools/dynamic-workflows/index.ts`:

```bash
pnpm exec omp --print --no-session --auto-approve --tools workflow \
  "Use the workflow tool. Run two task agents in parallel: one returns the package name from package.json and one returns the TypeScript target from tsconfig.json. Then run a final task agent that checks both answers and return a compact object with ok, packageName, and target."
```

Expected output contains:

```text
Workflow completed
pitlane
ES2022
```

If the active model declines the explicit tool request, rerun once with the tool's exact name and raw-script requirement in the prompt. Do not replace this check with direct module execution.

- [ ] **Step 4: Verify cancellation in an interactive smoke test**

Start:

```bash
pnpm exec omp --no-session --auto-approve --tools workflow
```

Prompt it to run two agents that inspect separate repository areas, then press Escape while both rows show running. Expected: the workflow reports `Workflow was aborted`, running rows become skipped, and `hub` shows no running workflow-owned peers after cancellation.

- [ ] **Step 5: Run repository formatting and lint checks on changed code**

```bash
pnpm exec oxfmt --check .omp/tools/dynamic-workflows package.json tsconfig.json
pnpm exec oxlint .omp/tools/dynamic-workflows
```

Expected: both commands exit 0. If formatting fails, run `pnpm exec oxfmt .omp/tools/dynamic-workflows package.json tsconfig.json`, then repeat the focused tests and TypeScript check.

- [ ] **Step 6: Commit verification coverage**

```bash
git add .omp/tools/dynamic-workflows package.json pnpm-lock.yaml tsconfig.json
git commit -m "Verify OMP dynamic workflows"
```
