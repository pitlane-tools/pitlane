import type { ESTree, Rollup } from "vite";

import { parseSync } from "vite";

import type { BrowserInput } from "./entries.ts";

import { declaredNames, scopeNames } from "./scope-names.ts";

/**
 * An export of another module. `module` is the import specifier as written
 * until {@link linkResolverUsage} replaces it with the resolved module id.
 */
export interface ImportedBinding {
    module: string;
    name: string;
}

/** A resolver constructed in this module, or a binding that may name one elsewhere. */
export type ResolverOrigin = "local" | ImportedBinding;

/** A string-literal `getScriptEntry` or `getHref` argument and the receiver it was called on. */
export interface LiteralCall {
    input: BrowserInput;
    receiver: ResolverOrigin;
}

/** What one module contributes to deciding which literal calls register browser inputs. */
export interface ResolverUsage {
    calls: LiteralCall[];
    /** Exported name → where the exported binding's resolver would come from. */
    resolverExports: Map<string, ResolverOrigin>;
}

interface TopLevelBindings {
    /** Local names of `createAssetResolver`, however it was imported. */
    constructors: Set<string>;
    /** Top-level variables initialized by a `createAssetResolver()` call. */
    resolvers: Set<string>;
    imports: Map<string, ImportedBinding>;
}

// A file re-exporting a resolver may mention neither method nor constructor.
const RELEVANT = /\bget(?:ScriptEntry|Href)\b|\bcreateAssetResolver\b|\bexport\s*(?:\{|default\b)/;

function moduleExportName(node: ESTree.IdentifierName | ESTree.StringLiteral): string {
    return node.type === "Literal" ? node.value : node.name;
}

function constructs(node: ESTree.Node | null | undefined, constructors: Set<string>): boolean {
    while (node?.type === "AwaitExpression" || node?.type === "ParenthesizedExpression")
        node = node.type === "AwaitExpression" ? node.argument : node.expression;
    return (
        node?.type === "CallExpression" &&
        node.callee.type === "Identifier" &&
        constructors.has(node.callee.name)
    );
}

function topLevelBindings(program: ESTree.Program): TopLevelBindings {
    let bindings: TopLevelBindings = {
        constructors: new Set(),
        resolvers: new Set(),
        imports: new Map(),
    };
    for (let statement of program.body) {
        if (statement.type !== "ImportDeclaration") continue;
        for (let specifier of statement.specifiers) {
            if (specifier.type === "ImportNamespaceSpecifier") continue;
            let name =
                specifier.type === "ImportDefaultSpecifier"
                    ? "default"
                    : moduleExportName(specifier.imported);
            if (name === "createAssetResolver") bindings.constructors.add(specifier.local.name);
            else
                bindings.imports.set(specifier.local.name, {
                    module: statement.source.value,
                    name,
                });
        }
    }
    for (let statement of program.body) {
        let declaration =
            statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
        if (declaration?.type !== "VariableDeclaration") continue;
        for (let { id, init } of declaration.declarations) {
            if (id.type === "Identifier" && constructs(init, bindings.constructors))
                bindings.resolvers.add(id.name);
        }
    }
    return bindings;
}

/** Where the resolver an expression evaluates to comes from, when the expression can name one. */
function resolverOrigin(
    node: ESTree.Node,
    bindings: TopLevelBindings,
    shadowed: ReadonlySet<string> = new Set(),
): ResolverOrigin | undefined {
    if (constructs(node, bindings.constructors)) return "local";
    if (node.type !== "Identifier" || shadowed.has(node.name)) return;
    if (bindings.resolvers.has(node.name)) return "local";
    return bindings.imports.get(node.name);
}

function literalCall(
    call: ESTree.CallExpression,
    bindings: TopLevelBindings,
    shadowed: ReadonlySet<string>,
): LiteralCall | undefined {
    let { callee, arguments: args } = call;
    if (callee.type !== "MemberExpression" || callee.computed) return;
    let method = callee.property.type === "Identifier" ? callee.property.name : undefined;
    let argument = args[0];
    if (method !== "getScriptEntry" && method !== "getHref") return;
    if (argument?.type !== "Literal" || typeof argument.value !== "string") return;
    let receiver = resolverOrigin(callee.object, bindings, shadowed);
    if (!receiver) return;
    return {
        input: { key: argument.value, kind: method === "getScriptEntry" ? "script" : "asset" },
        receiver,
    };
}

function literalCalls(program: ESTree.Program, bindings: TopLevelBindings): LiteralCall[] {
    let calls: LiteralCall[] = [];
    let pending: [unknown, ReadonlySet<string>][] = [[program.body, new Set()]];
    while (pending.length) {
        let [node, shadowed] = pending.pop()!;
        if (!node || typeof node !== "object") continue;
        if (Array.isArray(node)) {
            for (let child of node) pending.push([child, shadowed]);
            continue;
        }
        let current = node as ESTree.Node;
        let names = scopeNames(current);
        let scoped = names.length ? new Set([...shadowed, ...names]) : shadowed;
        if (current.type === "CallExpression") {
            let call = literalCall(current, bindings, scoped);
            if (call) calls.push(call);
        }
        for (let key in node) {
            let child = (node as Record<string, unknown>)[key];
            if (child && typeof child === "object") pending.push([child, scoped]);
        }
    }
    return calls;
}

function resolverExports(
    program: ESTree.Program,
    bindings: TopLevelBindings,
): Map<string, ResolverOrigin> {
    let exported = new Map<string, ResolverOrigin>();
    for (let statement of program.body) {
        if (statement.type === "ExportDefaultDeclaration") {
            let found = resolverOrigin(statement.declaration, bindings);
            if (found) exported.set("default", found);
        }
        if (statement.type !== "ExportNamedDeclaration") continue;
        for (let name of declaredNames(statement.declaration))
            if (bindings.resolvers.has(name)) exported.set(name, "local");
        for (let specifier of statement.specifiers) {
            let found = statement.source
                ? { module: statement.source.value, name: moduleExportName(specifier.local) }
                : resolverOrigin(specifier.local, bindings);
            if (found) exported.set(moduleExportName(specifier.exported), found);
        }
    }
    return exported;
}

/**
 * A module's literal `getScriptEntry` and `getHref` calls whose receiver may be
 * a resolver, and its exports that may name one. Import specifiers stay
 * unresolved; pass the result to {@link linkResolverUsage}.
 */
export function scanResolverUsage(code: string, id: string): ResolverUsage | undefined {
    if (!RELEVANT.test(code)) return;
    let { program } = parseSync(id, code);
    let bindings = topLevelBindings(program);
    let calls = literalCalls(program, bindings);
    let exported = resolverExports(program, bindings);
    if (calls.length === 0 && exported.size === 0) return;
    return { calls, resolverExports: exported };
}

/** Replaces import specifiers with module ids, dropping bindings whose module is external or unresolved. */
export async function linkResolverUsage(
    usage: ResolverUsage,
    resolve: (specifier: string) => Promise<Rollup.ResolvedId | null>,
): Promise<ResolverUsage> {
    let specifiers = new Set<string>();
    for (let origin of [
        ...usage.calls.map(call => call.receiver),
        ...usage.resolverExports.values(),
    ])
        if (origin !== "local") specifiers.add(origin.module);
    let resolved = new Map<string, string>();
    await Promise.all(
        [...specifiers].map(async specifier => {
            let module = await resolve(specifier);
            if (module && !module.external) resolved.set(specifier, module.id);
        }),
    );
    let link = (origin: ResolverOrigin): ResolverOrigin | undefined => {
        if (origin === "local") return origin;
        let module = resolved.get(origin.module);
        return module === undefined ? undefined : { module, name: origin.name };
    };
    let calls: LiteralCall[] = [];
    for (let call of usage.calls) {
        let receiver = link(call.receiver);
        if (receiver) calls.push({ input: call.input, receiver });
    }
    let exported = new Map<string, ResolverOrigin>();
    for (let [name, origin] of usage.resolverExports) {
        let linked = link(origin);
        if (linked) exported.set(name, linked);
    }
    return { calls, resolverExports: exported };
}

function isResolver(
    modules: ReadonlyMap<string, ResolverUsage>,
    origin: ResolverOrigin,
    seen: Set<string>,
): boolean {
    if (origin === "local") return true;
    let binding = `${origin.module}\0${origin.name}`;
    if (seen.has(binding)) return false;
    seen.add(binding);
    let exported = modules.get(origin.module)?.resolverExports.get(origin.name);
    return exported !== undefined && isResolver(modules, exported, seen);
}

/** The browser inputs a module's literal calls register, given its environment's linked usage. */
export function literalInputs(
    modules: ReadonlyMap<string, ResolverUsage>,
    id: string,
): BrowserInput[] {
    return (modules.get(id)?.calls ?? [])
        .filter(call => isResolver(modules, call.receiver, new Set()))
        .map(call => call.input);
}
