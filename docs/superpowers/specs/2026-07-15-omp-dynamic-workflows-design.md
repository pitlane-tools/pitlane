# OMP dynamic workflows custom tool

Date: 2026-07-15  
Status: Approved for implementation  
Source: [`Michaelliv/pi-dynamic-workflows`](https://github.com/Michaelliv/pi-dynamic-workflows) v1.0.1 at commit `31b2aca0f1cb195aafbfc5e3ee2b8c83ad3f21a2`

## Problem

`pi-dynamic-workflows` is a Pi extension built against `@earendil-works/pi-coding-agent`. Pitlane uses Oh My Pi and loads repository tools from `.omp/tools/<name>/index.ts`. The upstream extension cannot be dropped into that directory because its registration API, execute callback order, tool schema, subagent runtime, and package imports target Pi.

Pitlane needs a repository-local `workflow` tool that keeps the upstream workflow language and progress display while using OMP's agent profiles, task executor, model settings, output validation, artifacts, and cancellation behavior.

## Goals

- Register `workflow` through OMP's `CustomToolFactory` contract.
- Keep the Claude-style dynamic workflow model: a generated JavaScript program can branch, loop, fan out work, and synthesize results.
- Support `agent()`, `parallel()`, `pipeline()`, `phase()`, `log()`, `args`, `cwd`, `process.cwd()`, and `budget`.
- Resolve actual OMP agent profiles and run them through OMP's task executor.
- Stream compact phase and agent progress through the custom-tool update channel.
- Keep the port local, typed, tested, and traceable to the upstream revision.

## Non-goals

- No npm adapter around `pi-dynamic-workflows`.
- No compatibility layer for Pi's `ExtensionAPI`, `defineTool`, TypeBox, or legacy execute signature.
- No persisted workflow manager, resumable workflow run, or `/workflows` command.
- No nested workflow or task spawning from workflow agents.
- No worktree isolation. The upstream plugin only passed isolation as prompt text. Correct OMP isolation depends on the eval bridge's full `ToolSession`, which custom tools do not receive.
- No attempt to treat Node's `vm` module as a security boundary.

## Repository changes

The port lives in one discovery root:

```text
.omp/tools/dynamic-workflows/
  index.ts
  agent.ts
  display.ts
  workflow.ts
  *.test.ts
```

`index.ts` owns the OMP custom-tool boundary. `agent.ts` adapts workflow calls to OMP's task executor. `workflow.ts` owns parsing and runtime semantics. `display.ts` owns immutable snapshot data and text rendering. Tests stay beside these modules so the custom tool remains self-contained.

`tsconfig.json` adds `.omp/tools/**/*.ts` to `include`. `package.json` adds `oxc-parser` as a direct development dependency, consistent with this private repository's existing dependency layout.

## Custom tool contract

The default export has type `CustomToolFactory`. It returns one tool with these properties:

- `name`: `workflow`
- `label`: `Workflow`
- `loadMode`: `essential`
- `parameters`: a strict Zod object with required string `script` and optional unknown `args`
- `execute`: OMP's `(toolCallId, params, onUpdate, context, signal)` order

The tool description and guidelines tell the model when workflows are appropriate, define the required metadata header, document every runtime global, require short unique agent labels, and require a final synthesis agent when several branches feed one conclusion.

The tool accepts a raw JavaScript string. A single outer `js` or `javascript` Markdown fence is stripped defensively. Prose surrounding a fence remains invalid.

## Workflow parser

`oxc-parser` parses the script as JavaScript with `parseSync("<workflow-name>.js", source)`. Any parser diagnostic rejects the script before an agent starts.

The first statement must be:

```js
export const meta = {
  name: "short_snake_case",
  description: "Non-empty description",
}
```

`meta.phases` and `meta.whenToUse` remain optional. Metadata is evaluated by an AST literal walker rather than JavaScript execution. It accepts plain object and array literals, strings, numbers, booleans, null, static template literals, and negative numeric literals. It rejects spreads, computed keys, methods, accessors, sparse arrays, calls, interpolated templates, and prototype-related property names.

The parser walks the full AST and rejects `Date`, `Date.now()`, `Math.random()`, dynamic import, static import beyond the required metadata export, `require`, and direct eval-style code generation. The first export is removed by its OXC source range before the remaining program is executed.

## Workflow runtime

The runtime evaluates the body in a fresh `node:vm` context. String and WebAssembly code generation are disabled. The context exposes only the workflow globals, JSON, standard collection constructors, promises, a frozen `process` object with `cwd()`, and a frozen `Math` object without `random`. `Date`, host filesystem APIs, network APIs, `require`, and environment variables are absent.

`phase(title)` records a non-empty phase name and moves later agent calls into that phase. `log(message)` stores a text line. Duplicate phase names retain their first position.

`agent(prompt, options)` accepts:

```ts
{
  agent?: string
  model?: string | string[]
  label?: string
  schema?: unknown
}
```

The option name is `agent`, matching OMP's `task` tool and eval helper. The default profile is `task`.

`parallel(thunks)` requires an array of zero-argument functions and returns results in input order. Branch failures log an indexed error and become `null`, except cancellation, which aborts the workflow.

`pipeline(items, ...stages)` runs one stage across all items before the next stage begins. Each stage receives `(previousValue, originalItem, index)`. Items remain concurrent within a stage, results preserve input order, and a failed item becomes `null` for the rest of the pipeline.

A concurrency limiter bounds active agents to `1..16`. The default is derived from available hardware with two cores reserved for the host. The final workflow value must be structured-cloneable. A likely unawaited promise produces an error that names `agent()`, `parallel()`, and `pipeline()`.

`budget.spent()` sums the `tokens` field reported by successful and failed OMP subagent results. The adapter returns a normalized outcome for successful calls and carries token usage on its typed failure, so branch-local errors still count. `budget.remaining()` returns infinity when no total was configured. This replaces the upstream character-count estimate.

## OMP agent adapter

The adapter discovers OMP agents for the current working directory once per workflow invocation. It resolves the requested profile and rejects unknown or disabled profiles with the available names in the error.

The resolved profile keeps its system prompt, model selectors, thinking level, and read-summary preference. The adapter clears `spawns` and filters tools through this workflow allowlist:

```text
read, bash, edit, write, grep, glob, lsp, ast_edit,
eval, debug, browser, web_search
```

If the profile has no explicit tools, it receives the full allowlist. If it declares tools, it receives the intersection. OMP's public `runSubprocess()` adds `hub` to restricted profiles. `hub` may coordinate with existing peers but cannot create a new agent. `task` and `workflow` remain unavailable.

For each call, the adapter allocates a unique artifact-safe ID separate from the human label and invokes `runSubprocess()` with:

- the filtered `AgentDefinition`
- explicit workflow model override, then OMP's per-agent setting, then profile model
- schema as `outputSchema`
- parent model registry and settings
- OMP's active skills, with the profile's autoload names resolved to skill objects
- parent local protocol and artifact manager
- parent artifacts directory
- shared abort signal
- `keepAlive: false`

Schema-backed calls use OMP's native yield validation. The adapter parses a successful structured output as JSON. Text calls return `SingleResult.output`. A nonzero exit produces a typed failure with token usage and an error from `stderr`, `error`, or a stable fallback message. The workflow runtime records the usage, logs the failure at the branch boundary, and returns `null`.

## Progress and rendering

A workflow snapshot contains metadata, discovered phases, logs, agent rows, counters, duration, and final result. Agent rows contain a stable numeric order, label, phase, prompt, status, and optional preview.

The adapter maps OMP executor progress into the existing statuses: queued, running, done, error, and skipped. Updates are recomputed before delivery and streamed through `onUpdate`. The renderer groups rows by runtime phase, limits visible rows and logs, and uses OMP's injected `Text` component and theme.

The final tool result includes a concise text summary for the parent model and the complete snapshot in `details`. Rendering reads `details` for both partial and final states, so the transcript remains compact while machine-readable state survives branching.

## Cancellation and errors

An already-aborted signal prevents new work. Active `runSubprocess()` calls receive the same signal. Cancellation is never converted to `null`: it exits `parallel()` and `pipeline()`, marks running rows skipped, completes the final progress frame, and throws `Workflow was aborted`.

Parser failures, invalid metadata, sandbox violations, invalid runtime helper arguments, and non-cloneable final values fail the tool. Agent-specific failures remain branch-local. A script that finishes without calling `agent()` fails because a static workflow does not need this tool.

## Tests

Parser tests cover accepted metadata, body extraction, every rejected literal form, OXC diagnostics, reserved keys, nondeterministic APIs, imports, `require`, and code-generation attempts.

Runtime tests use an injected fake agent adapter. They cover phases, logs, args, cwd, ordered parallel results, staged pipeline barriers, concurrency limits, branch-local failures, cancellation, structured-clone validation, zero-agent rejection, and token accounting.

Agent adapter tests inject executor and discovery functions. They cover default and named profiles, disabled profiles, safe tool filtering, spawn removal, model precedence, artifact-safe IDs, text output, schema output, nonzero exits, progress forwarding, and abort propagation.

Tool tests instantiate the factory with a minimal OMP API double. They verify the Zod schema, essential load mode, execute callback order, fenced-script normalization, partial snapshots, final details, and renderer fallbacks.

## Verification

Implementation is complete when all of these checks pass:

1. The focused Vitest suite for `.omp/tools/dynamic-workflows/` passes.
2. The repository TypeScript check includes the tool directory and reports no diagnostics.
3. OMP's custom-tool loader loads `.omp/tools/dynamic-workflows/index.ts` and reports a `workflow` tool with no load error.
4. A loaded end-to-end workflow runs at least two agents, streams progress, performs a fan-in synthesis, and returns a structured-cloneable result.
5. Cancelling a loaded workflow stops its active agents and leaves no live workflow-owned agent session.

## Source tracking

The parser/runtime and display behavior derive from `pi-dynamic-workflows` v1.0.1 at the commit named above. Ported files retain a source attribution comment. OMP-specific execution, schemas, option names, token accounting, pipeline barriers, and tests are local changes and should stay separate enough to compare during future upstream updates.
