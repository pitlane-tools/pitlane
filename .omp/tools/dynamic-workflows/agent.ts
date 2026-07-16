// Ported from pi-dynamic-workflows v1.0.1, commit 31b2aca0f1cb195aafbfc5e3ee2b8c83ad3f21a2.
// Bridges the deterministic workflow runtime to OMP's native subagent executor.
import type { CustomToolContext } from "@oh-my-pi/pi-coding-agent";
import { getActiveSkills } from "@oh-my-pi/pi-coding-agent";
import {
  AgentOutputManager,
  discoverAgents,
  getAgent,
  type AgentDefinition,
} from "@oh-my-pi/pi-coding-agent/task";
import { runSubprocess } from "@oh-my-pi/pi-coding-agent/task/executor";
import { buildOutputValidator } from "@oh-my-pi/pi-coding-agent/tools/output-schema-validator";
import {
  WorkflowAgentFailure,
  type WorkflowAgentOutcome,
  type WorkflowAgentRequest,
  type WorkflowAgentRunner,
} from "./workflow.js";

// Tools a workflow subagent may keep. Everything else — notably `task` itself —
// is stripped so workflow agents cannot recursively spawn.
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
] as const;

/**
 * Host calls the adapter depends on, injectable so tests replace only the
 * process-touching functions while the adapter's own logic runs unchanged.
 * Production defaults bind the real OMP implementations.
 */
export interface OmpWorkflowAgentDependencies {
  discoverAgents: typeof discoverAgents;
  getActiveSkills: typeof getActiveSkills;
  runSubprocess: typeof runSubprocess;
}

const DEFAULT_DEPENDENCIES: OmpWorkflowAgentDependencies = Object.freeze({
  discoverAgents,
  getActiveSkills,
  runSubprocess,
});

/**
 * Runs each workflow agent request as an in-process OMP subagent. Resolves the
 * requested profile, hardens it against recursion, forwards session context to
 * `runSubprocess`, and normalizes the result into a {@link WorkflowAgentOutcome}
 * (or a {@link WorkflowAgentFailure} carrying the run's token count).
 */
export class OmpWorkflowAgent implements WorkflowAgentRunner {
  readonly #cwd: string;
  readonly #context: CustomToolContext;
  readonly #parentToolCallId: string | undefined;
  readonly #dependencies: OmpWorkflowAgentDependencies;
  readonly #outputManager: AgentOutputManager;
  #index = 0;
  // Serializes per-instance ID allocation so the manager's initial disk scan
  // completes before the next allocation runs — concurrent runs then never
  // reuse an existing artifact id.
  #allocationChain: Promise<unknown> = Promise.resolve();

  constructor(
    cwd: string,
    context: CustomToolContext,
    parentToolCallId?: string,
    dependencies: Partial<OmpWorkflowAgentDependencies> = {},
  ) {
    this.#cwd = cwd;
    this.#context = context;
    this.#parentToolCallId = parentToolCallId;
    this.#dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencies };
    this.#outputManager = new AgentOutputManager(() => context.sessionManager.getArtifactsDir());
  }

  async run(request: WorkflowAgentRequest): Promise<WorkflowAgentOutcome> {
    const context = this.#context;
    const dependencies = this.#dependencies;

    const { agents } = await dependencies.discoverAgents(this.#cwd);
    const profile = getAgent(agents, request.agent);
    if (!profile) {
      const available = agents.map(agent => agent.name).join(", ") || "none";
      throw new Error(`Unknown agent "${request.agent}". Available: ${available}`);
    }

    const disabledAgents = context.settings?.get("task.disabledAgents") ?? [];
    if (disabledAgents.includes(profile.name)) {
      throw new Error(
        `Agent "${profile.name}" is disabled in settings. Enable it via /agents, or use a different agent type.`,
      );
    }

    // Clone the profile, disable recursive spawns, and constrain tools to the
    // safe allowlist (full list when the profile declares none, otherwise the
    // intersection preserving the profile's ordering).
    const tools = profile.tools
      ? profile.tools.filter(tool => (SAFE_TOOLS as readonly string[]).includes(tool))
      : [...SAFE_TOOLS];
    const safeProfile: AgentDefinition = { ...profile, spawns: undefined, tools };

    const settingsModels = context.settings?.get("task.agentModelOverrides") ?? {};
    const modelOverride = request.model ?? settingsModels[profile.name];

    const index = ++this.#index;
    const id = await this.#allocateId(`Workflow${index}`);

    const activeSkills = dependencies.getActiveSkills();
    const autoloadNames = safeProfile.autoloadSkills ?? [];
    const autoloadSkills =
      autoloadNames.length > 0 && activeSkills.length > 0
        ? autoloadNames
            .map(name => activeSkills.find(skill => skill.name === name))
            .filter((skill): skill is NonNullable<typeof skill> => skill !== undefined)
        : [];

    const result = await dependencies.runSubprocess({
      cwd: this.#cwd,
      agent: safeProfile,
      task: request.prompt,
      assignment: request.prompt,
      description: request.label,
      parentToolCallId: this.#parentToolCallId,
      index,
      id,
      modelOverride,
      outputSchema: request.schema,
      outputSchemaOverridesAgent: request.schema !== undefined,
      signal: request.signal,
      onProgress: progress =>
        request.onProgress?.(progress.lastIntent ?? progress.currentTool ?? progress.status),
      modelRegistry: context.modelRegistry,
      settings: context.settings,
      skills: [...activeSkills],
      autoloadSkills,
      localProtocolOptions: context.localProtocolOptions,
      parentArtifactManager: context.sessionManager.getArtifactManager() ?? undefined,
      artifactsDir: context.sessionManager.getArtifactsDir() ?? undefined,
      keepAlive: false,
    });

    // Cancellation via the shared workflow signal wins over failure reporting so
    // an aborted run reads as a workflow abort, not an agent failure.
    if (request.signal?.aborted) {
      throw new Error("Workflow was aborted");
    }
    if (result.exitCode !== 0 || result.aborted) {
      const message =
        result.error || result.stderr || `Agent "${profile.name}" exited with code ${result.exitCode}`;
      throw new WorkflowAgentFailure(message, result.tokens);
    }

    if (request.schema !== undefined) {
      // Decode first: the executor emits a JSON document for object/array/quoted
      // outputs. A successful parse yields the structured value (quoted string ->
      // string, union object JSON -> object).
      try {
        return { value: JSON.parse(result.output), tokens: result.tokens };
      } catch (parseError) {
        // Parsing failed — the executor may have emitted unquoted text for a
        // schema that accepts a raw string. Accept it only if OMP's normalized
        // validator does (an unconstrained schema has no validator and accepts);
        // otherwise the output genuinely violates the schema.
        const { validator } = buildOutputValidator(request.schema);
        if (!validator || validator.validate(result.output).success) {
          return { value: result.output, tokens: result.tokens };
        }
        const message = parseError instanceof Error ? parseError.message : String(parseError);
        throw new WorkflowAgentFailure(message, result.tokens);
      }
    }

    return { value: result.output, tokens: result.tokens };
  }

  /**
   * Serialize allocation through a per-instance promise chain so the manager's
   * lazy disk scan runs to completion before the next allocation, keeping ids
   * unique across concurrent runs. Uniqueness stays owned by the manager.
   */
  #allocateId(base: string): Promise<string> {
    const allocated = this.#allocationChain.then(() => this.#outputManager.allocate(base));
    // Keep the chain alive across a rejected allocation so later runs still queue.
    this.#allocationChain = allocated.then(
      () => undefined,
      () => undefined,
    );
    return allocated;
  }
}
