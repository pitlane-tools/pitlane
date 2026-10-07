import type { ESTree } from "vite";

/** Calls `visit` on every AST node below `root`, in no particular order. */
export function forEachNode(root: ESTree.Node, visit: (node: ESTree.Node) => void): void {
    let pending: unknown[] = [root];
    while (pending.length) {
        let node = pending.pop();
        if (!node || typeof node !== "object") continue;
        if (Array.isArray(node)) {
            pending.push(...node);
            continue;
        }
        visit(node as ESTree.Node);
        for (let child of Object.values(node))
            if (child && typeof child === "object") pending.push(child);
    }
}

function patternNames(pattern: ESTree.Node | null): string[] {
    switch (pattern?.type) {
        case "Identifier":
            return [pattern.name];
        case "AssignmentPattern":
            return patternNames(pattern.left);
        case "RestElement":
            return patternNames(pattern.argument);
        case "TSParameterProperty":
            return patternNames(pattern.parameter);
        case "ArrayPattern":
            return pattern.elements.flatMap(patternNames);
        case "ObjectPattern":
            return pattern.properties.flatMap(property =>
                patternNames(property.type === "RestElement" ? property : property.value),
            );
        default:
            return [];
    }
}

/** The names a declaration binds in the scope that contains it. */
export function declaredNames(node: ESTree.Node | null): string[] {
    switch (node?.type) {
        case "VariableDeclaration":
            return node.declarations.flatMap(declarator => patternNames(declarator.id));
        case "FunctionDeclaration":
        case "TSDeclareFunction":
        case "ClassDeclaration":
        case "TSEnumDeclaration":
        case "TSImportEqualsDeclaration":
            return node.id ? [node.id.name] : [];
        case "TSModuleDeclaration":
            return node.id.type === "Identifier" ? [node.id.name] : [];
        default:
            return [];
    }
}

function boundNames(node: ESTree.Node): string[] {
    switch (node.type) {
        case "VariableDeclaration":
            return declaredNames(node);
        case "FunctionDeclaration":
        case "FunctionExpression":
        case "ArrowFunctionExpression": {
            let parameters = node.params.flatMap(patternNames);
            return node.type !== "ArrowFunctionExpression" && node.id
                ? [node.id.name, ...parameters]
                : parameters;
        }
        case "ClassExpression":
            return node.id ? [node.id.name] : [];
        case "CatchClause":
            return patternNames(node.param);
        case "ImportSpecifier":
        case "ImportDefaultSpecifier":
        case "ImportNamespaceSpecifier":
            return [node.local.name];
        default:
            return declaredNames(node);
    }
}

/** How many times a module binds each name, counting every declaration in every scope. */
export function bindingCounts(program: ESTree.Program): Map<string, number> {
    let counts = new Map<string, number>();
    forEachNode(program, node => {
        for (let name of boundNames(node)) counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return counts;
}
