// Ported from pi-dynamic-workflows v1.0.1, commit 31b2aca0f1cb195aafbfc5e3ee2b8c83ad3f21a2.
// Registers the deterministic workflow runtime as a discoverable OMP custom tool.
import type { CustomTool, CustomToolAPI, CustomToolFactory } from "@oh-my-pi/pi-coding-agent";
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

// Strip exactly one outer Markdown code fence when the entire script is wrapped in
// it; a fence that only wraps part of the input means the model sent prose around
// the script, which the deterministic runtime cannot parse.
const OUTER_FENCE = /^```[^\n]*\r?\n([\s\S]*?)\r?\n?```$/;

function normalizeWorkflowScript(script: string): string {
  const trimmed = script.trim();
  const fenced = OUTER_FENCE.exec(trimmed);
  if (fenced) return fenced[1];
  if (/^```/m.test(trimmed)) {
    throw new Error(
      "Workflow script must be raw JavaScript or a single fenced code block with no surrounding prose.",
    );
  }
  return trimmed;
}

function createParameters(api: CustomToolAPI) {
  return api.zod
    .object({
      script: api.zod.string().describe("Raw JavaScript workflow script without prose."),
      args: api.zod.unknown().optional(),
    })
    .strict();
}

function workflowResult(snapshot: WorkflowSnapshot, result: WorkflowRunResult) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Workflow ${result.meta.name} completed with ${result.agentCount} agent(s).\n\nResult:\n${JSON.stringify(result.result, null, 2)}`,
      },
    ],
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
            // Resolve the newest running row for this display id (ids are unique,
            // so this is the single row the completion belongs to).
            const row = snapshot.agents.find(
              agent => agent.id === event.id && agent.status === "running",
            );
            if (row) {
              row.status = event.error ? "error" : "done";
              if (event.error) row.error = event.error;
              else row.resultPreview = preview(event.result);
            }
            emit();
          },
        });

        snapshot.result = result.result;
        snapshot.durationMs = result.durationMs;
        emit(true);
        return workflowResult(snapshot, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (signal?.aborted || /abort(?:ed)?/i.test(message)) {
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
      return new api.pi.Text(
        first?.type === "text" ? first.text : theme.fg("muted", "workflow"),
        0,
        0,
      );
    },
  };
}

const factory: CustomToolFactory = api => createWorkflowTool(api);
export default factory;
