import type { ESTree, Rollup } from "vite";

import { parseSync } from "vite";

import type { BrowserInput } from "./entries.ts";
import type { TopLevelBindings } from "./resolver-bindings.ts";

import { declaredNames, forEachNode } from "./binding-names.ts";
import { moduleExportName, resolverOrigin, topLevelBindings } from "./resolver-bindings.ts";

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
    /**
     * Exported name → where the exported binding's resolver would come from,
     * or `null` for an explicit export that cannot name one. An explicit export
     * hides any same-named binding of {@link starExports}.
     */
    resolverExports: Map<string, ResolverOrigin | null>;
    /** Modules this one re-exports with `export * from`, as written until linked. */
    starExports: string[];
}

// A file re-exporting a resolver may mention neither method nor constructor.
const RELEVANT = /\bget(?:ScriptEntry|Href)\b|\bcreateAssetResolver\b|\bexport\b/;

/** The method a member call names, through `.name` or a string-literal `["name"]`. */
function memberName(callee: ESTree.MemberExpression): string | undefined {
    let { property } = callee;
    if (!callee.computed) return property.type === "Identifier" ? property.name : undefined;
    return property.type === "Literal" && typeof property.value === "string"
        ? property.value
        : undefined;
}

function literalCall(
    call: ESTree.CallExpression,
    bindings: TopLevelBindings,
): LiteralCall | undefined {
    let { callee, arguments: args } = call;
    if (callee.type !== "MemberExpression") return;
    let method = memberName(callee);
    let argument = args[0];
    if (method !== "getScriptEntry" && method !== "getHref") return;
    if (argument?.type !== "Literal" || typeof argument.value !== "string") return;
    let receiver = resolverOrigin(callee.object, bindings);
    if (!receiver) return;
    return {
        input: { key: argument.value, kind: method === "getScriptEntry" ? "script" : "asset" },
        receiver,
    };
}

function resolverExports(
    program: ESTree.Program,
    bindings: TopLevelBindings,
): Map<string, ResolverOrigin | null> {
    let exported = new Map<string, ResolverOrigin | null>();
    for (let statement of program.body) {
        if (statement.type === "ExportDefaultDeclaration")
            exported.set("default", resolverOrigin(statement.declaration, bindings) ?? null);
        if (statement.type === "ExportAllDeclaration" && statement.exported)
            exported.set(moduleExportName(statement.exported), null);
        if (statement.type !== "ExportNamedDeclaration") continue;
        for (let name of declaredNames(statement.declaration))
            exported.set(name, bindings.resolvers.get(name) ?? null);
        for (let specifier of statement.specifiers) {
            let found = statement.source
                ? { module: statement.source.value, name: moduleExportName(specifier.local) }
                : resolverOrigin(specifier.local, bindings);
            exported.set(moduleExportName(specifier.exported), found ?? null);
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
    let calls: LiteralCall[] = [];
    forEachNode(program, node => {
        let call = node.type === "CallExpression" ? literalCall(node, bindings) : undefined;
        if (call) calls.push(call);
    });
    let exported = resolverExports(program, bindings);
    let starExports = program.body.flatMap(statement =>
        statement.type === "ExportAllDeclaration" && !statement.exported
            ? [statement.source.value]
            : [],
    );
    let namesResolver = [...exported.values()].some(origin => origin !== null);
    if (calls.length === 0 && !namesResolver && starExports.length === 0) return;
    return { calls, resolverExports: exported, starExports };
}

/** Replaces import specifiers with module ids, dropping those that are external or unresolved. */
export async function linkResolverUsage(
    usage: ResolverUsage,
    resolve: (specifier: string) => Promise<Rollup.ResolvedId | null>,
): Promise<ResolverUsage> {
    let specifiers = new Set<string>(usage.starExports);
    for (let origin of [
        ...usage.calls.map(call => call.receiver),
        ...usage.resolverExports.values(),
    ])
        if (origin && origin !== "local") specifiers.add(origin.module);
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
    let exported = new Map<string, ResolverOrigin | null>();
    for (let [name, origin] of usage.resolverExports)
        exported.set(name, origin && (link(origin) ?? null));
    let starExports = usage.starExports.flatMap(specifier => resolved.get(specifier) ?? []);
    return { calls, resolverExports: exported, starExports };
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
    let usage = modules.get(origin.module);
    let exported = usage?.resolverExports.get(origin.name);
    if (!usage || exported === null) return false;
    if (exported) return isResolver(modules, exported, seen);
    // `export *` never re-exports a default export.
    return (
        origin.name !== "default" &&
        usage.starExports.some(module => isResolver(modules, { module, name: origin.name }, seen))
    );
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
