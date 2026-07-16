import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveSkills as defaultGetActiveSkills, type CustomToolContext, type Skill } from "@oh-my-pi/pi-coding-agent";
import {
  discoverAgents as defaultDiscoverAgents,
  type AgentDefinition,
  type AgentProgress,
  type SingleResult,
} from "@oh-my-pi/pi-coding-agent/task";
import type { ExecutorOptions } from "@oh-my-pi/pi-coding-agent/task/executor";
import { OmpWorkflowAgent, type OmpWorkflowAgentDependencies } from "./agent.js";
import { WorkflowAgentFailure, type WorkflowAgentRequest } from "./workflow.js";

// The real OMP `/task` and `/task/executor` entrypoints eagerly load
// `pi-natives`, which cannot initialize under vitest. Mock them at the module
// seam so `agent.ts` keeps its production imports while the adapter's own logic
// runs against injected doubles. `getAgent` and `AgentOutputManager` are used
// directly (not injected), so their mocks reproduce real behavior — including
// the manager's init-before-await window, so the adapter's per-instance
// serialization is genuinely exercised.
const { fakeDisk, allocateCalls, allocation } = vi.hoisted(() => ({
  fakeDisk: new Set<string>(),
  allocateCalls: [] as string[],
  allocation: { active: 0, overlapped: false },
}));

vi.mock("@oh-my-pi/pi-coding-agent", () => ({
  getActiveSkills: vi.fn(() => []),
}));
vi.mock("@oh-my-pi/pi-coding-agent/task", () => ({
  AgentOutputManager: class {
    #initialized = false;
    readonly #taken = new Set<string>(["__advisor"]);
    readonly #getArtifactsDir: () => string | null;
    constructor(getArtifactsDir: () => string | null) {
      this.#getArtifactsDir = getArtifactsDir;
    }
    async #ensureInitialized(): Promise<void> {
      if (this.#initialized) return;
      // Mirror the real manager: the flag flips before the async scan, so an
      // unserialized concurrent allocation observes a not-yet-populated set.
      this.#initialized = true;
      const dir = this.#getArtifactsDir();
      if (!dir) return;
      await Promise.resolve();
      for (const file of fakeDisk) {
        if (!file.endsWith(".md")) continue;
        const stem = file.slice(0, -3);
        const dot = stem.indexOf(".");
        const segment = dot === -1 ? stem : stem.slice(0, dot);
        if (segment) this.#taken.add(segment);
      }
    }
    async allocate(id: string): Promise<string> {
      allocateCalls.push(id);
      allocation.active += 1;
      // Any concurrent second entry proves the adapter failed to serialize.
      if (allocation.active > 1) allocation.overlapped = true;
      try {
        await this.#ensureInitialized();
        let candidate = id;
        for (let n = 2; this.#taken.has(candidate); n++) candidate = `${id}-${n}`;
        this.#taken.add(candidate);
        return candidate;
      } finally {
        allocation.active -= 1;
      }
    }
  },
  discoverAgents: vi.fn(),
  getAgent: (agents: AgentDefinition[], name: string): AgentDefinition | undefined =>
    agents.find(agent => agent.name === name),
}));
vi.mock("@oh-my-pi/pi-coding-agent/task/executor", () => ({
  runSubprocess: vi.fn(),
}));

const SAFE_TOOLS = [
  "read",
  "bash",
  "edit",
  "write",
  "grep",
  "glob",
  "lsp",
  "ast_edit",
  "eval",
  "debug",
  "browser",
  "web_search",
];

const REVIEWER: AgentDefinition = {
  name: "reviewer",
  description: "Reviews code",
  systemPrompt: "You review code.",
  tools: ["read", "grep", "lsp", "task"],
  spawns: ["scout"],
  source: "bundled",
};

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
    agent: "reviewer",
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

function makeProgress(overrides: Partial<AgentProgress> = {}): AgentProgress {
  return {
    index: 0,
    id: "Workflow1",
    agent: "reviewer",
    agentSource: "bundled",
    status: "running",
    task: "",
    recentTools: [],
    recentOutput: [],
    toolCount: 0,
    requests: 0,
    tokens: 0,
    cost: 0,
    durationMs: 0,
    ...overrides,
  };
}

interface ContextOptions {
  disabledAgents?: string[];
  agentModelOverrides?: Record<string, string>;
  artifactsDir?: string | null;
  artifactManager?: unknown;
  localProtocolOptions?: unknown;
}

function makeContext(options: ContextOptions = {}): CustomToolContext {
  const settingsValues: Record<string, unknown> = {
    "task.disabledAgents": options.disabledAgents ?? [],
    "task.agentModelOverrides": options.agentModelOverrides ?? {},
  };
  return {
    sessionManager: {
      getArtifactsDir: () => options.artifactsDir ?? null,
      getArtifactManager: () => options.artifactManager ?? null,
    },
    settings: { get: (key: string) => settingsValues[key] },
    modelRegistry: {},
    localProtocolOptions: options.localProtocolOptions,
  } as unknown as CustomToolContext;
}

function setup(config: {
  agents: AgentDefinition[];
  context?: CustomToolContext;
  skills?: Skill[];
  runSubprocess?: (options: ExecutorOptions) => Promise<SingleResult>;
}) {
  const impl = config.runSubprocess ?? (async (_options: ExecutorOptions) => makeResult());
  const runSubprocess = vi.fn(impl);
  const discoverAgents = vi.fn(async () => ({ agents: config.agents, projectAgentsDir: null }));
  const activeSkills = config.skills ?? [];
  const getActiveSkills = vi.fn(() => activeSkills);
  const dependencies: OmpWorkflowAgentDependencies = { discoverAgents, getActiveSkills, runSubprocess };
  const context = config.context ?? makeContext();
  const agent = new OmpWorkflowAgent("/repo", context, "parent-call", dependencies);
  return { agent, runSubprocess, discoverAgents, getActiveSkills };
}

function request(overrides: Partial<WorkflowAgentRequest> = {}): WorkflowAgentRequest {
  return { prompt: "do the work", agent: "reviewer", label: "Review the change", ...overrides };
}

beforeEach(() => {
  fakeDisk.clear();
  allocateCalls.length = 0;
  allocation.active = 0;
  allocation.overlapped = false;
  vi.mocked(defaultDiscoverAgents).mockReset();
  vi.mocked(defaultGetActiveSkills).mockReset().mockReturnValue([]);
});

describe("OmpWorkflowAgent", () => {
  it("issues the exact native executor call", async () => {
    const schema = { type: "object" };
    const { agent, runSubprocess } = setup({
      agents: [REVIEWER],
      runSubprocess: async () => makeResult({ output: "{}" }),
    });

    await agent.run(request({ agent: "reviewer", model: ["openai/gpt-5.6"], schema }));

    expect(runSubprocess).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: expect.objectContaining({
          name: "reviewer",
          spawns: undefined,
          tools: ["read", "grep", "lsp"],
        }),
        outputSchema: schema,
        outputSchemaOverridesAgent: true,
        keepAlive: false,
        modelOverride: ["openai/gpt-5.6"],
      }),
    );
  });

  it("forwards cwd, prompt, label, and parent tool call id", async () => {
    const { agent, runSubprocess } = setup({ agents: [REVIEWER] });

    await agent.run(request({ prompt: "inspect module", label: "Inspect" }));

    expect(runSubprocess).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: "/repo",
        task: "inspect module",
        assignment: "inspect module",
        description: "Inspect",
        parentToolCallId: "parent-call",
      }),
    );
  });

  it("defaults to the full safe-tool allowlist for a profile without tools", async () => {
    const { agent, runSubprocess } = setup({ agents: [TASK] });

    await agent.run(request({ agent: "task" }));

    expect(runSubprocess).toHaveBeenCalledWith(
      expect.objectContaining({ agent: expect.objectContaining({ tools: SAFE_TOOLS }) }),
    );
  });

  it("rejects an unknown profile", async () => {
    const { agent, runSubprocess } = setup({ agents: [TASK] });

    await expect(agent.run(request({ agent: "ghost" }))).rejects.toThrow(/Unknown agent "ghost"/);
    expect(runSubprocess).not.toHaveBeenCalled();
  });

  it("rejects a disabled profile", async () => {
    const context = makeContext({ disabledAgents: ["reviewer"] });
    const { agent, runSubprocess } = setup({ agents: [REVIEWER], context });

    await expect(agent.run(request({ agent: "reviewer" }))).rejects.toThrow(/disabled/);
    expect(runSubprocess).not.toHaveBeenCalled();
  });

  it("applies the settings model override when the request omits a model", async () => {
    const context = makeContext({ agentModelOverrides: { reviewer: "anthropic/claude" } });
    const { agent, runSubprocess } = setup({ agents: [REVIEWER], context });

    await agent.run(request({ agent: "reviewer", model: undefined }));

    expect(runSubprocess).toHaveBeenCalledWith(
      expect.objectContaining({ modelOverride: "anthropic/claude" }),
    );
  });

  it("prefers the request model over the settings override", async () => {
    const context = makeContext({ agentModelOverrides: { reviewer: "anthropic/claude" } });
    const { agent, runSubprocess } = setup({ agents: [REVIEWER], context });

    await agent.run(request({ agent: "reviewer", model: ["openai/gpt-5.6"] }));

    expect(runSubprocess).toHaveBeenCalledWith(
      expect.objectContaining({ modelOverride: ["openai/gpt-5.6"] }),
    );
  });

  it("resolves autoload skills from the profile against active skills", async () => {
    const brainstorming: Skill = {
      name: "brainstorming",
      description: "",
      filePath: "/skills/brainstorming.md",
      baseDir: "/skills",
      source: "bundled",
    };
    const other: Skill = {
      name: "other",
      description: "",
      filePath: "/skills/other.md",
      baseDir: "/skills",
      source: "bundled",
    };
    const profile: AgentDefinition = { ...REVIEWER, autoloadSkills: ["brainstorming", "missing"] };
    const { agent, runSubprocess } = setup({ agents: [profile], skills: [brainstorming, other] });

    await agent.run(request({ agent: "reviewer" }));

    expect(runSubprocess).toHaveBeenCalledWith(
      expect.objectContaining({
        skills: [brainstorming, other],
        autoloadSkills: [brainstorming],
      }),
    );
  });

  it("merges partial dependencies with the frozen production defaults", async () => {
    vi.mocked(defaultDiscoverAgents).mockResolvedValue({ agents: [REVIEWER], projectAgentsDir: null });
    vi.mocked(defaultGetActiveSkills).mockReturnValue([]);
    const runSubprocess = vi.fn(async (_options: ExecutorOptions) => makeResult({ output: "done" }));

    // Only `runSubprocess` overridden; `discoverAgents` and `getActiveSkills`
    // must still come from the untouched, frozen defaults.
    const agent = new OmpWorkflowAgent("/repo", makeContext(), "parent-call", { runSubprocess });
    const outcome = await agent.run(request({ schema: undefined }));

    expect(outcome).toEqual({ value: "done", tokens: 0 });
    expect(runSubprocess).toHaveBeenCalledTimes(1);
    expect(defaultDiscoverAgents).toHaveBeenCalledWith("/repo");
    expect(defaultGetActiveSkills).toHaveBeenCalled();
  });

  it("allocates sequential IDs through the manager", async () => {
    const { agent, runSubprocess } = setup({ agents: [REVIEWER] });

    await agent.run(request());
    await agent.run(request());

    expect(allocateCalls).toEqual(["Workflow1", "Workflow2"]);
    expect(runSubprocess).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: "Workflow1", index: 1 }));
    expect(runSubprocess).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "Workflow2", index: 2 }));
  });

  it("serializes allocation so concurrent runs never reuse an existing artifact", async () => {
    fakeDisk.add("Workflow1.md");
    fakeDisk.add("Workflow2.md");
    const context = makeContext({ artifactsDir: "/artifacts" });
    const ids: string[] = [];
    const { agent } = setup({
      agents: [REVIEWER],
      context,
      runSubprocess: async (options: ExecutorOptions) => {
        ids.push(options.id);
        return makeResult({ id: options.id });
      },
    });

    await Promise.all([agent.run(request()), agent.run(request())]);

    // Serialized: the second allocate never runs while the first is mid-scan.
    expect(allocation.overlapped).toBe(false);
    expect(new Set(ids).size).toBe(2);
    expect(ids).not.toContain("Workflow1");
    expect(ids).not.toContain("Workflow2");
  });

  it("returns raw text output when no schema is requested", async () => {
    const { agent, runSubprocess } = setup({
      agents: [REVIEWER],
      runSubprocess: async () => makeResult({ output: "plain text", tokens: 12 }),
    });

    const outcome = await agent.run(request({ schema: undefined }));

    expect(outcome).toEqual({ value: "plain text", tokens: 12 });
    expect(runSubprocess).toHaveBeenCalledWith(
      expect.objectContaining({ outputSchema: undefined, outputSchemaOverridesAgent: false }),
    );
  });

  it("parses structured output when an object schema is requested", async () => {
    const schema = { type: "object" };
    const { agent, runSubprocess } = setup({
      agents: [REVIEWER],
      runSubprocess: async () => makeResult({ output: '{"ok":true}', tokens: 8 }),
    });

    const outcome = await agent.run(request({ schema }));

    expect(outcome).toEqual({ value: { ok: true }, tokens: 8 });
    expect(runSubprocess).toHaveBeenCalledWith(
      expect.objectContaining({ outputSchema: schema, outputSchemaOverridesAgent: true }),
    );
  });

  it("returns unquoted text for a schema that accepts a top-level string", async () => {
    const { agent, runSubprocess } = setup({
      agents: [REVIEWER],
      // The executor writes an unquoted string for a top-level-string schema;
      // JSON.parse would throw on this, so the adapter must not parse it.
      runSubprocess: async () => makeResult({ output: "just plain prose", tokens: 4 }),
    });

    const outcome = await agent.run(request({ schema: { type: "string" } }));

    expect(outcome).toEqual({ value: "just plain prose", tokens: 4 });
    expect(runSubprocess).toHaveBeenCalledWith(
      expect.objectContaining({ outputSchemaOverridesAgent: true }),
    );
  });

  it("returns raw output for a union schema that includes a top-level string", async () => {
    const { agent } = setup({
      agents: [REVIEWER],
      runSubprocess: async () => makeResult({ output: "unquoted", tokens: 2 }),
    });

    const outcome = await agent.run(request({ schema: { type: ["string", "null"] } }));

    expect(outcome).toEqual({ value: "unquoted", tokens: 2 });
  });

  it("wraps malformed object-schema JSON in a WorkflowAgentFailure preserving tokens", async () => {
    const { agent } = setup({
      agents: [REVIEWER],
      runSubprocess: async () => makeResult({ output: "not json", tokens: 5 }),
    });

    const error = await agent.run(request({ schema: { type: "object" } })).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WorkflowAgentFailure);
    expect((error as WorkflowAgentFailure).tokens).toBe(5);
  });

  it("throws a WorkflowAgentFailure with tokens on a nonzero exit", async () => {
    const { agent } = setup({
      agents: [REVIEWER],
      runSubprocess: async () => makeResult({ exitCode: 1, error: "boom", tokens: 4242 }),
    });

    const error = await agent.run(request()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WorkflowAgentFailure);
    expect((error as WorkflowAgentFailure).message).toContain("boom");
    expect((error as WorkflowAgentFailure).tokens).toBe(4242);
  });

  it("treats an executor-reported abort as a failure with tokens", async () => {
    const { agent } = setup({
      agents: [REVIEWER],
      runSubprocess: async () => makeResult({ exitCode: 0, aborted: true, tokens: 9 }),
    });

    const error = await agent.run(request()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WorkflowAgentFailure);
    expect((error as WorkflowAgentFailure).tokens).toBe(9);
  });

  it("throws a plain abort error when the shared signal aborted, ahead of failure normalization", async () => {
    const controller = new AbortController();
    const { agent } = setup({
      agents: [REVIEWER],
      runSubprocess: async () => {
        controller.abort();
        return makeResult({ exitCode: 1, error: "boom", tokens: 3 });
      },
    });

    const error = await agent.run(request({ signal: controller.signal })).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(WorkflowAgentFailure);
    expect((error as Error).message).toBe("Workflow was aborted");
  });

  it("forwards progress preferring lastIntent, then currentTool, then status", async () => {
    const messages: string[] = [];
    const { agent } = setup({
      agents: [REVIEWER],
      runSubprocess: async (options: ExecutorOptions) => {
        options.onProgress?.(makeProgress({ lastIntent: "reading files", currentTool: "read" }));
        options.onProgress?.(makeProgress({ lastIntent: undefined, currentTool: "grep" }));
        options.onProgress?.(
          makeProgress({ lastIntent: undefined, currentTool: undefined, status: "running" }),
        );
        return makeResult();
      },
    });

    await agent.run(request({ onProgress: message => messages.push(message) }));

    expect(messages).toEqual(["reading files", "grep", "running"]);
  });
});
