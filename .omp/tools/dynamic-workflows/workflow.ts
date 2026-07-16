// Ported from pi-dynamic-workflows v1.0.1, commit 31b2aca0f1cb195aafbfc5e3ee2b8c83ad3f21a2.
import type { OxcError, Program } from "oxc-parser";

import vm from "node:vm";
import { parseSync } from "oxc-parser";

declare global {
    interface PromiseConstructor {
        withResolvers<T>(): {
            promise: Promise<T>;
            resolve(value: T | PromiseLike<T>): void;
            reject(reason?: unknown): void;
        };
    }
}

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
    constructor(
        message: string,
        readonly tokens: number,
    ) {
        super(message);
        this.name = "WorkflowAgentFailure";
    }
}

export interface WorkflowRunOptions {
    cwd?: string;
    args?: unknown;
    runner: WorkflowAgentRunner;
    concurrency?: number;
    tokenBudget?: number | null;
    signal?: AbortSignal;
    onLog?: (message: string) => void;
    onPhase?: (title: string) => void;
    onAgentStart?: (event: { id: number; label: string; phase?: string; prompt: string }) => void;
    onAgentProgress?: (event: {
        id: number;
        label: string;
        phase?: string;
        message: string;
    }) => void;
    onAgentEnd?: (
        event: { id: number; label: string; phase?: string } & (
            | { result: unknown; error?: never }
            | { result?: never; error: string }
        ),
    ) => void;
}

export interface WorkflowRunResult<T = unknown> {
    meta: WorkflowMeta;
    result: T;
    logs: string[];
    phases: string[];
    agentCount: number;
    tokens: number;
    durationMs: number;
}

interface WorkflowAgentOptions {
    agent?: string;
    model?: string | string[];
    label?: string;
    schema?: unknown;
}

interface WorkflowRuntimeState {
    currentPhase?: string;
    logs: string[];
    phases: string[];
    agentCount: number;
    tokens: number;
    pending: Set<Promise<unknown>>;
}

interface PipelineSlot {
    original: unknown;
    value: unknown;
    failed: boolean;
}

export async function runWorkflow<T = unknown>(
    program: { meta: WorkflowMeta; body: string },
    options: WorkflowRunOptions,
): Promise<WorkflowRunResult<T>> {
    let started = Date.now();
    let state: WorkflowRuntimeState = {
        logs: [],
        phases: [],
        agentCount: 0,
        tokens: 0,
        pending: new Set(),
    };
    let concurrency = normalizeConcurrency(options.concurrency);
    let limiter = createLimiter(concurrency);
    let cwd =
        options.cwd === undefined ? process.cwd() : requireString(options.cwd, "workflow cwd");
    let tokenBudget = normalizeTokenBudget(options.tokenBudget);

    let closeController = new AbortController();
    let closeSignal = closeController.signal;
    let closeWorkflow = () => {
        if (!closeSignal.aborted) closeController.abort();
    };

    let throwIfAborted = () => {
        if (options.signal?.aborted) throw workflowAbortedError();
    };

    let log = (message: unknown) => {
        if (closeSignal.aborted) return;
        let text = String(message);
        state.logs.push(text);
        options.onLog?.(text);
    };

    let phase = (title: unknown) => {
        if (closeSignal.aborted) return;
        let text = requireNonEmptyString(title, "phase title");
        state.currentPhase = text;
        if (!state.phases.includes(text)) state.phases.push(text);
        options.onPhase?.(text);
    };

    let budget = Object.freeze({
        total: tokenBudget,
        spent: () => state.tokens,
        remaining: () =>
            tokenBudget === null ? Infinity : Math.max(0, tokenBudget - state.tokens),
    });

    let track = <T>(promise: Promise<T>): Promise<T> => {
        state.pending.add(promise);
        void promise.then(
            () => state.pending.delete(promise),
            () => state.pending.delete(promise),
        );
        return promise;
    };

    let agent = (prompt: unknown, agentOptions: unknown = {}): Promise<unknown> => {
        throwIfAborted();
        if (closeSignal.aborted) throw new Error("workflow is closing; no new agents may start");
        if (budget.total !== null && budget.remaining() <= 0) {
            throw new Error("workflow token budget exhausted");
        }
        let taskPrompt = requireNonEmptyString(prompt, "agent prompt");
        let normalizedOptions = normalizeAgentOptions(agentOptions);
        let id = ++state.agentCount;
        let assignedPhase = state.currentPhase;
        let label =
            normalizedOptions.label ??
            (assignedPhase ? `${assignedPhase} agent ${id}` : `agent ${id}`);

        let run = limiter(async () => {
            throwIfAborted();
            if (closeSignal.aborted)
                throw new Error("workflow is closing; no new agents may start");
            options.onAgentStart?.({ id, label, phase: assignedPhase, prompt: taskPrompt });
            try {
                let outcome = await raceAbort(
                    options.runner.run({
                        prompt: taskPrompt,
                        agent: normalizedOptions.agent ?? "task",
                        model: normalizedOptions.model,
                        label,
                        schema: normalizedOptions.schema,
                        phase: assignedPhase,
                        signal: options.signal,
                        onProgress: message => {
                            options.onAgentProgress?.({ id, label, phase: assignedPhase, message });
                        },
                    }),
                    options.signal,
                );
                state.tokens += outcome.tokens;
                throwIfAborted();
                options.onAgentEnd?.({ id, label, phase: assignedPhase, result: outcome.value });
                return outcome.value;
            } catch (error) {
                if (options.signal?.aborted) {
                    options.onAgentEnd?.({
                        id,
                        label,
                        phase: assignedPhase,
                        error: "Workflow was aborted",
                    });
                    throw workflowAbortedError();
                }
                let message = errorMessage(error);
                if (error instanceof WorkflowAgentFailure) state.tokens += error.tokens;
                log(`agent ${label} failed: ${message}`);
                options.onAgentEnd?.({ id, label, phase: assignedPhase, error: message });
                return null;
            }
        });

        return track(run);
    };

    let runParallel = async (thunks: unknown): Promise<unknown[]> => {
        throwIfAborted();
        if (!Array.isArray(thunks)) throw new TypeError("parallel() expects an array of functions");
        if (thunks.some(thunk => typeof thunk !== "function")) {
            throw new TypeError(
                "parallel() expects an array of functions, not promises. Wrap each call: () => agent(...)",
            );
        }
        if (closeSignal.aborted) return thunks.map(() => null);
        return Promise.all(
            thunks.map(async (thunk, index) => {
                try {
                    return await raceAbort(
                        Promise.resolve((thunk as () => unknown)()),
                        closeSignal,
                    );
                } catch (error) {
                    if (options.signal?.aborted) throw workflowAbortedError();
                    if (closeSignal.aborted) return null;
                    log(`parallel[${index}] failed: ${errorMessage(error)}`);
                    return null;
                }
            }),
        );
    };
    let parallel = (thunks: unknown): Promise<unknown[]> => {
        let result = runParallel(thunks);
        void result.catch(() => {});
        return result;
    };

    let runPipeline = async (items: unknown, stages: unknown[]): Promise<unknown[]> => {
        throwIfAborted();
        if (!Array.isArray(items))
            throw new TypeError("pipeline() expects an array as the first argument");
        if (stages.some(stage => typeof stage !== "function")) {
            throw new TypeError(
                "pipeline() stages must be functions: pipeline(items, item => ..., result => ...)",
            );
        }
        if (closeSignal.aborted) return items.map(() => null);

        let slots: PipelineSlot[] = items.map(item => ({
            original: item,
            value: item,
            failed: false,
        }));
        for (let stage of stages as Array<
            (value: unknown, original: unknown, index: number) => unknown
        >) {
            if (closeSignal.aborted) break;
            await Promise.all(
                slots.map(async (slot, index) => {
                    if (slot.failed) return;
                    try {
                        throwIfAborted();
                        slot.value = await raceAbort(
                            Promise.resolve(stage(slot.value, slot.original, index)),
                            closeSignal,
                        );
                        throwIfAborted();
                        if (slot.value === null) slot.failed = true;
                    } catch (error) {
                        if (options.signal?.aborted) throw workflowAbortedError();
                        slot.value = null;
                        slot.failed = true;
                        if (closeSignal.aborted) return;
                        log(`pipeline[${index}] failed: ${errorMessage(error)}`);
                    }
                }),
            );
        }
        return slots.map(slot => slot.value);
    };
    let pipeline = (items: unknown, ...stages: unknown[]): Promise<unknown[]> => {
        let result = runPipeline(items, stages);
        void result.catch(() => {});
        return result;
    };

    let safeMath = Object.freeze(
        Object.fromEntries(
            Object.getOwnPropertyNames(Math)
                .filter(name => name !== "random")
                .map(name => [name, Object.getOwnPropertyDescriptor(Math, name)?.value]),
        ),
    );

    let context = vm.createContext(
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

    throwIfAborted();
    let wrapped = `(async () => {\n${program.body}\n})()`;
    let executionResult: unknown;
    let executionError: unknown;
    let executionFailed = false;
    try {
        executionResult = await raceAbort(
            new vm.Script(wrapped, {
                filename: `${program.meta.name || "workflow"}.js`,
            }).runInContext(context) as Promise<unknown>,
            options.signal,
        );
    } catch (error) {
        executionFailed = true;
        executionError = error;
    } finally {
        closeWorkflow();
        while (state.pending.size > 0) {
            await Promise.allSettled(state.pending);
        }
    }

    throwIfAborted();
    if (executionFailed) throw executionError;
    if (state.agentCount === 0) throw new Error("Workflow must call at least one agent");
    let clonedResult = cloneWorkflowResult(executionResult);

    return {
        meta: program.meta,
        result: clonedResult as T,
        logs: state.logs,
        phases: state.phases,
        agentCount: state.agentCount,
        tokens: state.tokens,
        durationMs: Date.now() - started,
    };
}

function createLimiter(limit: number) {
    let active = 0;
    let queue: Array<(value: void) => void> = [];
    return async <T>(fn: () => Promise<T>): Promise<T> => {
        if (active < limit) {
            active++;
        } else {
            let { promise, resolve } = Promise.withResolvers<void>();
            queue.push(resolve);
            await promise;
        }
        try {
            return await fn();
        } finally {
            let resume = queue.shift();
            if (resume) resume(undefined);
            else active--;
        }
    };
}

function normalizeConcurrency(value: number | undefined): number {
    let fallback = Math.min(16, Math.max(1, (globalThis.navigator?.hardwareConcurrency ?? 8) - 2));
    if (value === undefined || !Number.isFinite(value)) return fallback;
    return Math.min(16, Math.max(1, Math.floor(value)));
}

function normalizeTokenBudget(value: number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError("workflow token budget must be a non-negative finite number");
    }
    return value;
}

function normalizeAgentOptions(value: unknown): WorkflowAgentOptions {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("agent options must be an object");
    }
    let options = value as Record<string, unknown>;
    return {
        agent: optionalNonEmptyString(options.agent, "agent profile"),
        model: optionalModel(options.model),
        label: optionalNonEmptyString(options.label, "agent label"),
        schema: options.schema,
    };
}

function optionalModel(value: unknown): string | string[] | undefined {
    if (value === undefined) return undefined;
    if (typeof value === "string") return requireNonEmptyString(value, "agent model");
    if (
        !Array.isArray(value) ||
        value.length === 0 ||
        value.some(model => typeof model !== "string" || !model.trim())
    ) {
        throw new TypeError("agent model must be a non-empty string or array of non-empty strings");
    }
    return Array.from(value) as string[];
}

function optionalNonEmptyString(value: unknown, name: string): string | undefined {
    if (value === undefined) return undefined;
    return requireNonEmptyString(value, name);
}

function requireNonEmptyString(value: unknown, name: string): string {
    let text = requireString(value, name);
    if (!text.trim()) throw new TypeError(`${name} must be a non-empty string`);
    return text;
}

function requireString(value: unknown, name: string): string {
    if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
    return value;
}

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(workflowAbortedError());
    let { promise: guarded, resolve, reject } = Promise.withResolvers<T>();
    let onAbort = () => reject(workflowAbortedError());
    signal.addEventListener("abort", onAbort, { once: true });
    void promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
    return guarded;
}

function workflowAbortedError(): Error {
    return new Error("Workflow was aborted");
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function cloneWorkflowResult(value: unknown): unknown {
    try {
        return structuredClone(value);
    } catch (error) {
        let detail = error instanceof Error ? ` ${error.message}` : "";
        throw new Error(
            `workflow result must be structured-cloneable; did you forget to await agent(), parallel(), or pipeline()?${detail}`,
        );
    }
}

type AstNode = {
    type: string;
    start: number;
    end: number;
    [key: string]: unknown;
};

const NONDETERMINISM_ERROR =
    "Workflow scripts must be deterministic: Date.now(), Math.random(), and new Date() are unavailable";

export function parseWorkflowScript(script: string): { meta: WorkflowMeta; body: string } {
    let result = parseSync("workflow.js", script, {
        lang: "js",
        sourceType: "module",
        astType: "js",
        range: true,
        preserveParens: false,
        showSemanticErrors: true,
    });
    let program = result.program as Program & AstNode;
    let fatal = result.errors.find(
        error => error.severity === "Error" && !isWorkflowLevelReturnDiagnostic(error, program),
    );
    if (fatal) throw new Error(fatal.codeframe ?? fatal.message);

    let first = program.body[0] as unknown as AstNode | undefined;
    if (first?.type !== "ExportNamedDeclaration") {
        throw new Error("`export const meta = { name, description }` must be the first statement");
    }
    assertAvailableAst(program, first);
    let declaration = first.declaration as AstNode | null;
    if (declaration?.type !== "VariableDeclaration" || declaration.kind !== "const") {
        throw new Error("meta export must be `export const meta = ...`");
    }
    let declarations = declaration.declarations as AstNode[];
    if (declarations.length !== 1) throw new Error("meta export must declare only `meta`");
    let declarator = declarations[0];
    let id = declarator.id as AstNode;
    if (id.type !== "Identifier" || id.name !== "meta")
        throw new Error("meta export must declare `meta`");
    let meta = evaluateLiteral(declarator.init as AstNode, "meta");
    validateMeta(meta);
    return { meta, body: script.slice(0, first.start) + script.slice(first.end) };
}

function isWorkflowLevelReturnDiagnostic(error: OxcError, program: AstNode): boolean {
    if (error.message !== "A 'return' statement can only be used within a function body.")
        return false;
    return error.labels.some(label => hasWorkflowLevelReturnAt(program, label.start, label.end));
}

function hasWorkflowLevelReturnAt(node: AstNode, labelStart: number, labelEnd: number): boolean {
    if (labelStart < node.start || labelEnd > node.end) return false;
    if (
        node.type === "StaticBlock" ||
        node.type === "FunctionDeclaration" ||
        node.type === "FunctionExpression" ||
        node.type === "ArrowFunctionExpression"
    ) {
        return false;
    }
    if (node.type === "ReturnStatement") return node.start === labelStart;

    for (let [key, value] of Object.entries(node)) {
        if (key === "start" || key === "end" || key === "range") continue;
        if (Array.isArray(value)) {
            for (let child of value) {
                if (isAstNode(child) && hasWorkflowLevelReturnAt(child, labelStart, labelEnd))
                    return true;
            }
        } else if (isAstNode(value) && hasWorkflowLevelReturnAt(value, labelStart, labelEnd)) {
            return true;
        }
    }
    return false;
}

function evaluateLiteral(node: AstNode, path: string): unknown {
    switch (node.type) {
        case "ObjectExpression": {
            let result: Record<string, unknown> = {};
            for (let property of node.properties as AstNode[]) {
                if (property.type === "SpreadElement")
                    throw new Error(`spread not allowed in ${path}`);
                if (property.type !== "Property")
                    throw new Error(`only plain properties allowed in ${path}`);
                if (property.computed) throw new Error(`computed keys not allowed in ${path}`);
                if (property.kind !== "init" || property.method) {
                    throw new Error(`methods/accessors not allowed in ${path}`);
                }
                let key = propertyKey(property.key as AstNode, path);
                if (key === "__proto__" || key === "constructor" || key === "prototype") {
                    throw new Error(`reserved key name not allowed in ${path}: ${key}`);
                }
                result[key] = evaluateLiteral(property.value as AstNode, `${path}.${key}`);
            }
            return result;
        }
        case "ArrayExpression":
            return (node.elements as Array<AstNode | null>).map((element, index) => {
                if (!element) throw new Error(`sparse arrays not allowed in ${path}`);
                if (element.type === "SpreadElement")
                    throw new Error(`spread not allowed in ${path}`);
                return evaluateLiteral(element, `${path}[${index}]`);
            });
        case "Literal":
            return node.value;
        case "TemplateLiteral": {
            let expressions = node.expressions as AstNode[];
            if (expressions.length > 0)
                throw new Error(`template interpolation not allowed in ${path}`);
            return (node.quasis as AstNode[])
                .map(quasi => {
                    let value = quasi.value as { cooked?: string | null; raw: string };
                    return value.cooked ?? value.raw;
                })
                .join("");
        }
        case "UnaryExpression": {
            let argument = node.argument as AstNode;
            if (
                node.operator === "-" &&
                argument.type === "Literal" &&
                typeof argument.value === "number"
            ) {
                return -argument.value;
            }
            throw new Error(`only negative-number unary allowed in ${path}`);
        }
        default:
            throw new Error(`non-literal node type in ${path}: ${node.type}`);
    }
}

function propertyKey(node: AstNode, path: string): string {
    if (node.type === "Identifier") return node.name as string;
    if (
        node.type === "Literal" &&
        (typeof node.value === "string" || typeof node.value === "number")
    ) {
        return String(node.value);
    }
    throw new Error(`unsupported key type in ${path}: ${node.type}`);
}

function validateMeta(meta: unknown): asserts meta is WorkflowMeta {
    if (!meta || typeof meta !== "object") throw new Error("meta must be an object");
    let value = meta as Record<string, unknown>;
    if (typeof value.name !== "string" || !value.name.trim()) {
        throw new Error("meta.name must be a non-empty string");
    }
    if (typeof value.description !== "string" || !value.description.trim()) {
        throw new Error("meta.description must be a non-empty string");
    }
    if (value.whenToUse !== undefined && typeof value.whenToUse !== "string") {
        throw new Error("meta.whenToUse must be a string");
    }
    if (value.phases === undefined) return;
    if (!Array.isArray(value.phases)) throw new Error("meta.phases must be an array");
    for (let phase of value.phases) {
        if (!phase || typeof phase !== "object" || Array.isArray(phase)) {
            throw new Error("each meta phase must be an object with a non-empty title string");
        }
        let candidate = phase as Record<string, unknown>;
        if (typeof candidate.title !== "string" || !candidate.title.trim()) {
            throw new Error("each meta phase must have a non-empty title string");
        }
        if (candidate.detail !== undefined && typeof candidate.detail !== "string") {
            throw new Error("meta phase detail must be a string");
        }
        if (candidate.model !== undefined && typeof candidate.model !== "string") {
            throw new Error("meta phase model must be a string");
        }
    }
}

function assertAvailableAst(node: AstNode, allowedMetaExport: AstNode): void {
    if (node === allowedMetaExport) return;

    if (node.type.startsWith("Import") || node.type.startsWith("Export")) {
        throw new Error("imports and exports are unavailable in workflow scripts");
    }
    if (node.type === "MetaProperty") {
        throw new Error("meta properties are unavailable in workflow scripts");
    }
    if (
        isNewDateExpression(node) ||
        isMemberCall(node, "Date", "now") ||
        isMemberCall(node, "Math", "random")
    ) {
        throw new Error(NONDETERMINISM_ERROR);
    }
    if (isIdentifierCall(node, "require"))
        throw new Error("require() is unavailable in workflow scripts");
    if (isIdentifierCall(node, "eval"))
        throw new Error("eval() is unavailable in workflow scripts");

    for (let [key, value] of Object.entries(node)) {
        if (key === "start" || key === "end" || key === "range") continue;
        if (Array.isArray(value)) {
            for (let child of value) {
                if (isAstNode(child)) assertAvailableAst(child, allowedMetaExport);
            }
        } else if (isAstNode(value)) {
            assertAvailableAst(value, allowedMetaExport);
        }
    }
}

function isAstNode(value: unknown): value is AstNode {
    return (
        value !== null &&
        typeof value === "object" &&
        typeof (value as { type?: unknown }).type === "string"
    );
}

function isIdentifierCall(node: AstNode, name: string): boolean {
    if (node.type !== "CallExpression" || !isAstNode(node.callee)) return false;
    return node.callee.type === "Identifier" && node.callee.name === name;
}

function isMemberCall(node: AstNode, objectName: string, propertyName: string): boolean {
    if (
        node.type !== "CallExpression" ||
        !isAstNode(node.callee) ||
        node.callee.type !== "MemberExpression"
    ) {
        return false;
    }
    let object = node.callee.object;
    if (!isAstNode(object) || object.type !== "Identifier" || object.name !== objectName)
        return false;
    return memberPropertyName(node.callee) === propertyName;
}

function memberPropertyName(node: AstNode): string | undefined {
    let property = node.property;
    if (!isAstNode(property)) return undefined;
    if (!node.computed && property.type === "Identifier") return property.name as string;
    if (property.type === "Literal" && typeof property.value === "string") return property.value;
    if (property.type === "TemplateLiteral" && (property.expressions as AstNode[]).length === 0) {
        return (property.quasis as AstNode[])
            .map(quasi => {
                let value = quasi.value as { cooked?: string | null; raw: string };
                return value.cooked ?? value.raw;
            })
            .join("");
    }
    return undefined;
}

function isNewDateExpression(node: AstNode): boolean {
    if (node.type !== "NewExpression" || !isAstNode(node.callee)) return false;
    return node.callee.type === "Identifier" && node.callee.name === "Date";
}
