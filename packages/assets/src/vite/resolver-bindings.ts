import type { ESTree } from "vite";

import type { ImportedBinding, ResolverOrigin } from "./resolver-usage.ts";

import { bindingCounts } from "./binding-names.ts";

/**
 * Top-level names that qualify as constructor or receiver. A name qualifies
 * only when the module binds it exactly once, so no inner scope can shadow it.
 */
export interface TopLevelBindings {
    /** Local names of Pitlane's `createAssetResolver`, and top-level copies of it. */
    constructors: Set<string>;
    /** Names that hold a resolver, or an import that may name one. */
    resolvers: Map<string, ResolverOrigin>;
}

export function moduleExportName(node: ESTree.IdentifierName | ESTree.StringLiteral): string {
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

/** The name a chain of top-level `const a = b` copies starts from. */
function aliasRoot(name: string, initializers: Map<string, ESTree.Expression>): string {
    let seen = new Set<string>();
    let init = initializers.get(name);
    while (init?.type === "Identifier" && !seen.has(name)) {
        seen.add(name);
        name = init.name;
        init = initializers.get(name);
    }
    return name;
}

export function topLevelBindings(program: ESTree.Program): TopLevelBindings {
    let counts = bindingCounts(program);
    let importedConstructors = new Set<string>();
    let imports = new Map<string, ImportedBinding>();
    let initializers = new Map<string, ESTree.Expression>();
    for (let statement of program.body) {
        if (statement.type === "ImportDeclaration") {
            let module = statement.source.value;
            for (let specifier of statement.specifiers) {
                let local = specifier.local.name;
                if (specifier.type === "ImportNamespaceSpecifier" || counts.get(local) !== 1)
                    continue;
                let name =
                    specifier.type === "ImportDefaultSpecifier"
                        ? "default"
                        : moduleExportName(specifier.imported);
                if (
                    name === "createAssetResolver" &&
                    (module === "@pitlane/assets" || module === "pitlane/assets")
                )
                    importedConstructors.add(local);
                else imports.set(local, { module, name });
            }
        }
        let declaration =
            statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
        if (declaration?.type !== "VariableDeclaration") continue;
        for (let { id, init } of declaration.declarations)
            if (id.type === "Identifier" && init && counts.get(id.name) === 1)
                initializers.set(id.name, init);
    }

    let constructors = new Set(importedConstructors);
    for (let name of initializers.keys())
        if (importedConstructors.has(aliasRoot(name, initializers))) constructors.add(name);
    let resolvers = new Map<string, ResolverOrigin>();
    for (let name of [...imports.keys(), ...initializers.keys()]) {
        let root = aliasRoot(name, initializers);
        let origin: ResolverOrigin | undefined =
            imports.get(root) ??
            (constructs(initializers.get(root), constructors) ? "local" : undefined);
        if (origin) resolvers.set(name, origin);
    }
    return { constructors, resolvers };
}

/** Where the resolver an expression evaluates to comes from, when the expression can name one. */
export function resolverOrigin(
    node: ESTree.Node,
    bindings: TopLevelBindings,
): ResolverOrigin | undefined {
    if (constructs(node, bindings.constructors)) return "local";
    if (node.type === "Identifier") return bindings.resolvers.get(node.name);
}
