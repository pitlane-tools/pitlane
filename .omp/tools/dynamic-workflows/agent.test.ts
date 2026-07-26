import type { ExecutorOptions } from "@oh-my-pi/pi-coding-agent/task/executor";

import {
    getActiveSkills as defaultGetActiveSkills,
    type CustomToolContext,
    type Skill,
} from "@oh-my-pi/pi-coding-agent";
import {
    discoverAgents as defaultDiscoverAgents,
    type AgentDefinition,
    type AgentProgress,
    type SingleResult,
} from "@oh-my-pi/pi-coding-agent/task";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OmpWorkflowAgent, type OmpWorkflowAgentDependencies } from "./agent.js";
import { WorkflowAgentFailure, type WorkflowAgentRequest } from "./workflow.js";

// The real OMP `/task` and `/task/executor` entrypoints eagerly load
// `pi-natives`, which cannot initialize under vitest. Mock them at the module
// seam so `agent.ts` keeps its production imports while the adapter's own logic
// runs against injected doubles. `getAgent` and `AgentOutputManager` are used
// directly (not injected), so their mocks reproduce real behavior — including
// the manager's init-before-await window, so the adapter's per-instance
// serialization is genuinely exercised.
let { fakeDisk, allocateCalls, allocation } = vi.hoisted(() => ({
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
            let dir = this.#getArtifactsDir();
            if (!dir) return;
            await Promise.resolve();
            for (let file of fakeDisk) {
                if (!file.endsWith(".md")) continue;
                let stem = file.slice(0, -3);
                let dot = stem.indexOf(".");
                let segment = dot === -1 ? stem : stem.slice(0, dot);
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
// The real MCP manager loads `pi-utils` (crashes under vitest). This empty
// stand-in mirrors the only surface the adapter relies on: a fresh manager has no
// tools, so passing it disables MCP for the child and yields zero proxy tools.
vi.mock("@oh-my-pi/pi-coding-agent/mcp/manager", () => ({
    MCPManager: class {
        getTools() {
            return [];
        }
    },
}));
// The real validator loads `pi-utils`, which reads `Bun.env` at import and
// crashes under vitest. This stand-in reproduces the JSON-Schema type checks the
// adapter relies on (type, type-arrays, anyOf/oneOf; unconstrained schemas have
// no validator and accept anything), matching OMP's normalized semantics.
vi.mock("@oh-my-pi/pi-coding-agent/tools/output-schema-validator", () => {
    let matchesType = (type: unknown, value: unknown): boolean => {
        switch (type) {
            case "string":
                return typeof value === "string";
            case "object":
                return typeof value === "object" && value !== null && !Array.isArray(value);
            case "array":
                return Array.isArray(value);
            case "number":
            case "integer":
                return typeof value === "number";
            case "boolean":
                return typeof value === "boolean";
            case "null":
                return value === null;
            default:
                return true;
        }
    };
    let matches = (schema: unknown, value: unknown): boolean => {
        if (typeof schema !== "object" || schema === null) return true;
        let record = schema as Record<string, unknown>;
        let branches = record.anyOf ?? record.oneOf;
        if (Array.isArray(branches)) return branches.some(branch => matches(branch, value));
        let type = record.type;
        if (type === undefined) return true;
        let types = Array.isArray(type) ? type : [type];
        return types.some(candidate => matchesType(candidate, value));
    };
    return {
        buildOutputValidator: (schema: unknown) => {
            if (schema === undefined || schema === true) return {};
            return {
                validator: { validate: (value: unknown) => ({ success: matches(schema, value) }) },
            };
        },
    };
});

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
    let settingsValues: Record<string, unknown> = {
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
    let impl = config.runSubprocess ?? (async (_options: ExecutorOptions) => makeResult());
    let runSubprocess = vi.fn(impl);
    let discoverAgents = vi.fn(async () => ({ agents: config.agents, projectAgentsDir: null }));
    let activeSkills = config.skills ?? [];
    let getActiveSkills = vi.fn(() => activeSkills);
    let dependencies: OmpWorkflowAgentDependencies = {
        discoverAgents,
        getActiveSkills,
        runSubprocess,
    };
    let context = config.context ?? makeContext();
    let agent = new OmpWorkflowAgent("/repo", context, "parent-call", dependencies);
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
        let schema = { type: "object" };
        let { agent, runSubprocess } = setup({
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
        let { agent, runSubprocess } = setup({ agents: [REVIEWER] });

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
        let { agent, runSubprocess } = setup({ agents: [TASK] });

        await agent.run(request({ agent: "task" }));

        expect(runSubprocess).toHaveBeenCalledWith(
            expect.objectContaining({ agent: expect.objectContaining({ tools: SAFE_TOOLS }) }),
        );
    });

    it("rejects an unknown profile", async () => {
        let { agent, runSubprocess } = setup({ agents: [TASK] });

        await expect(agent.run(request({ agent: "ghost" }))).rejects.toThrow(
            /Unknown agent "ghost"/,
        );
        expect(runSubprocess).not.toHaveBeenCalled();
    });

    it("rejects a disabled profile", async () => {
        let context = makeContext({ disabledAgents: ["reviewer"] });
        let { agent, runSubprocess } = setup({ agents: [REVIEWER], context });

        await expect(agent.run(request({ agent: "reviewer" }))).rejects.toThrow(/disabled/);
        expect(runSubprocess).not.toHaveBeenCalled();
    });

    it("applies the settings model override when the request omits a model", async () => {
        let context = makeContext({ agentModelOverrides: { reviewer: "anthropic/claude" } });
        let { agent, runSubprocess } = setup({ agents: [REVIEWER], context });

        await agent.run(request({ agent: "reviewer", model: undefined }));

        expect(runSubprocess).toHaveBeenCalledWith(
            expect.objectContaining({ modelOverride: "anthropic/claude" }),
        );
    });

    it("prefers the request model over the settings override", async () => {
        let context = makeContext({ agentModelOverrides: { reviewer: "anthropic/claude" } });
        let { agent, runSubprocess } = setup({ agents: [REVIEWER], context });

        await agent.run(request({ agent: "reviewer", model: ["openai/gpt-5.6"] }));

        expect(runSubprocess).toHaveBeenCalledWith(
            expect.objectContaining({ modelOverride: ["openai/gpt-5.6"] }),
        );
    });

    it("resolves autoload skills from the profile against active skills", async () => {
        let brainstorming: Skill = {
            name: "brainstorming",
            description: "",
            filePath: "/skills/brainstorming.md",
            baseDir: "/skills",
            source: "bundled",
        };
        let other: Skill = {
            name: "other",
            description: "",
            filePath: "/skills/other.md",
            baseDir: "/skills",
            source: "bundled",
        };
        let profile: AgentDefinition = {
            ...REVIEWER,
            autoloadSkills: ["brainstorming", "missing"],
        };
        let { agent, runSubprocess } = setup({
            agents: [profile],
            skills: [brainstorming, other],
        });

        await agent.run(request({ agent: "reviewer" }));

        expect(runSubprocess).toHaveBeenCalledWith(
            expect.objectContaining({
                skills: [brainstorming, other],
                autoloadSkills: [brainstorming],
            }),
        );
    });

    it("merges partial dependencies with the frozen production defaults", async () => {
        vi.mocked(defaultDiscoverAgents).mockResolvedValue({
            agents: [REVIEWER],
            projectAgentsDir: null,
        });
        vi.mocked(defaultGetActiveSkills).mockReturnValue([]);
        let runSubprocess = vi.fn(async (_options: ExecutorOptions) =>
            makeResult({ output: "done" }),
        );

        // Only `runSubprocess` overridden; `discoverAgents` and `getActiveSkills`
        // must still come from the untouched, frozen defaults.
        let agent = new OmpWorkflowAgent("/repo", makeContext(), "parent-call", {
            runSubprocess,
        });
        let outcome = await agent.run(request({ schema: undefined }));

        expect(outcome).toEqual({ value: "done", tokens: 0 });
        expect(runSubprocess).toHaveBeenCalledTimes(1);
        expect(defaultDiscoverAgents).toHaveBeenCalledWith("/repo");
        expect(defaultGetActiveSkills).toHaveBeenCalled();
    });

    it("allocates sequential IDs through the manager", async () => {
        let { agent, runSubprocess } = setup({ agents: [REVIEWER] });

        await agent.run(request());
        await agent.run(request());

        expect(allocateCalls).toEqual(["Workflow1", "Workflow2"]);
        expect(runSubprocess).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ id: "Workflow1", index: 1 }),
        );
        expect(runSubprocess).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ id: "Workflow2", index: 2 }),
        );
    });

    it("serializes allocation so concurrent runs never reuse an existing artifact", async () => {
        fakeDisk.add("Workflow1.md");
        fakeDisk.add("Workflow2.md");
        let context = makeContext({ artifactsDir: "/artifacts" });
        let ids: string[] = [];
        let { agent } = setup({
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
        let { agent, runSubprocess } = setup({
            agents: [REVIEWER],
            runSubprocess: async () => makeResult({ output: "plain text", tokens: 12 }),
        });

        let outcome = await agent.run(request({ schema: undefined }));

        expect(outcome).toEqual({ value: "plain text", tokens: 12 });
        expect(runSubprocess).toHaveBeenCalledWith(
            expect.objectContaining({ outputSchema: undefined, outputSchemaOverridesAgent: false }),
        );
    });

    it("parses structured output when an object schema is requested", async () => {
        let schema = { type: "object" };
        let { agent, runSubprocess } = setup({
            agents: [REVIEWER],
            runSubprocess: async () => makeResult({ output: '{"ok":true}', tokens: 8 }),
        });

        let outcome = await agent.run(request({ schema }));

        expect(outcome).toEqual({ value: { ok: true }, tokens: 8 });
        expect(runSubprocess).toHaveBeenCalledWith(
            expect.objectContaining({ outputSchema: schema, outputSchemaOverridesAgent: true }),
        );
    });

    it("returns unquoted text for a schema that accepts a top-level string", async () => {
        let { agent, runSubprocess } = setup({
            agents: [REVIEWER],
            // The executor emits an unquoted string here; JSON.parse fails and the
            // validator accepts the raw string, so the adapter returns it verbatim.
            runSubprocess: async () => makeResult({ output: "just plain prose", tokens: 4 }),
        });

        let outcome = await agent.run(request({ schema: { type: "string" } }));

        expect(outcome).toEqual({ value: "just plain prose", tokens: 4 });
        expect(runSubprocess).toHaveBeenCalledWith(
            expect.objectContaining({ outputSchemaOverridesAgent: true }),
        );
    });

    it("returns raw output for a union schema that includes a top-level string", async () => {
        let { agent } = setup({
            agents: [REVIEWER],
            runSubprocess: async () => makeResult({ output: "unquoted", tokens: 2 }),
        });

        let outcome = await agent.run(request({ schema: { type: ["string", "null"] } }));

        expect(outcome).toEqual({ value: "unquoted", tokens: 2 });
    });

    it("decodes a quoted JSON string under a string schema", async () => {
        let { agent } = setup({
            agents: [REVIEWER],
            runSubprocess: async () => makeResult({ output: '"hello"', tokens: 6 }),
        });

        let outcome = await agent.run(request({ schema: { type: "string" } }));

        expect(outcome).toEqual({ value: "hello", tokens: 6 });
    });

    it("decodes a union object payload to an object", async () => {
        let { agent } = setup({
            agents: [REVIEWER],
            runSubprocess: async () => makeResult({ output: '{"k":"v"}', tokens: 7 }),
        });

        let outcome = await agent.run(
            request({ schema: { anyOf: [{ type: "string" }, { type: "object" }] } }),
        );

        expect(outcome).toEqual({ value: { k: "v" }, tokens: 7 });
    });

    it("wraps malformed object-schema JSON in a WorkflowAgentFailure preserving tokens", async () => {
        let { agent } = setup({
            agents: [REVIEWER],
            runSubprocess: async () => makeResult({ output: "not json", tokens: 5 }),
        });

        let error = await agent
            .run(request({ schema: { type: "object" } }))
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(WorkflowAgentFailure);
        expect((error as WorkflowAgentFailure).tokens).toBe(5);
    });

    it("throws a WorkflowAgentFailure with tokens on a nonzero exit", async () => {
        let { agent } = setup({
            agents: [REVIEWER],
            runSubprocess: async () => makeResult({ exitCode: 1, error: "boom", tokens: 4242 }),
        });

        let error = await agent.run(request()).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(WorkflowAgentFailure);
        expect((error as WorkflowAgentFailure).message).toContain("boom");
        expect((error as WorkflowAgentFailure).tokens).toBe(4242);
    });

    it("treats an executor-reported abort as a failure with tokens", async () => {
        let { agent } = setup({
            agents: [REVIEWER],
            runSubprocess: async () => makeResult({ exitCode: 0, aborted: true, tokens: 9 }),
        });

        let error = await agent.run(request()).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(WorkflowAgentFailure);
        expect((error as WorkflowAgentFailure).tokens).toBe(9);
    });

    it("throws a plain abort error when the shared signal aborted, ahead of failure normalization", async () => {
        let controller = new AbortController();
        let { agent } = setup({
            agents: [REVIEWER],
            runSubprocess: async () => {
                controller.abort();
                return makeResult({ exitCode: 1, error: "boom", tokens: 3 });
            },
        });

        let error = await agent
            .run(request({ signal: controller.signal }))
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(WorkflowAgentFailure);
        expect((error as Error).message).toBe("Workflow was aborted");
    });

    it("forwards progress preferring lastIntent, then currentTool, then status", async () => {
        let messages: string[] = [];
        let { agent } = setup({
            agents: [REVIEWER],
            runSubprocess: async (options: ExecutorOptions) => {
                options.onProgress?.(
                    makeProgress({ lastIntent: "reading files", currentTool: "read" }),
                );
                options.onProgress?.(makeProgress({ lastIntent: undefined, currentTool: "grep" }));
                options.onProgress?.(
                    makeProgress({
                        lastIntent: undefined,
                        currentTool: undefined,
                        status: "running",
                    }),
                );
                return makeResult();
            },
        });

        await agent.run(request({ onProgress: message => messages.push(message) }));

        expect(messages).toEqual(["reading files", "grep", "running"]);
    });

    it("isolates child sessions from custom-tool, extension, and MCP rediscovery", async () => {
        let { agent, runSubprocess } = setup({ agents: [REVIEWER] });

        await agent.run(request({ schema: undefined }));

        let options = vi.mocked(runSubprocess).mock.calls[0][0];
        // Empty preloaded path lists skip the child's own custom-tool and extension
        // FS scans, so it cannot rediscover `workflow` (recursion) or extension tools.
        expect(options.preloadedCustomToolPaths).toEqual([]);
        expect(options.preloadedExtensionPaths).toEqual([]);
        // A fresh, empty MCP manager disables the child's MCP discovery and proxies
        // nothing (safe `agent.tools` cannot filter MCP tools — OMP always includes
        // custom/extension tools regardless of the allowlist).
        expect(options.mcpManager).toBeDefined();
        expect(options.mcpManager?.getTools()).toEqual([]);
        // The safe profile never exposes the recursive `workflow`/`task` tools.
        expect(options.agent.tools).not.toContain("workflow");
        expect(options.agent.tools).not.toContain("task");
    });

    it("rejects a profile whose declared tools have no safe intersection", async () => {
        let unsafe: AgentDefinition = { ...REVIEWER, tools: ["task"] };
        let { agent, runSubprocess } = setup({ agents: [unsafe] });

        await expect(agent.run(request({ agent: "reviewer" }))).rejects.toThrow(
            /no workflow-safe tools/i,
        );
        // The empty safe intersection must be rejected before execution, never
        // silently re-expanded to the full OMP default tool set.
        expect(runSubprocess).not.toHaveBeenCalled();
    });

    it("keeps unquoted output a string when a parseable value fails the schema", async () => {
        let { agent } = setup({
            agents: [REVIEWER],
            // "123" parses to the number 123, which fails a string schema; the raw
            // text is a valid string, so the adapter returns it verbatim.
            runSubprocess: async () => makeResult({ output: "123", tokens: 3 }),
        });

        let outcome = await agent.run(request({ schema: { type: "string" } }));

        expect(outcome).toEqual({ value: "123", tokens: 3 });
    });

    it("discovers agents once per instance across concurrent and later requests", async () => {
        let { agent, discoverAgents } = setup({ agents: [REVIEWER] });

        await Promise.all([agent.run(request()), agent.run(request())]);
        await agent.run(request());

        expect(discoverAgents).toHaveBeenCalledTimes(1);
    });
});
