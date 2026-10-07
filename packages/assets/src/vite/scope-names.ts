import type { ESTree } from "vite";

function patternNames(pattern: ESTree.Node | null): string[] {
    switch (pattern?.type) {
        case "Identifier":
            return [pattern.name];
        case "AssignmentPattern":
            return patternNames(pattern.left);
        case "RestElement":
            return patternNames(pattern.argument);
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

/** The names a variable, function, or class declaration binds. */
export function declaredNames(statement: ESTree.Node | null): string[] {
    if (statement?.type === "VariableDeclaration")
        return statement.declarations.flatMap(declarator => patternNames(declarator.id));
    if (
        (statement?.type === "FunctionDeclaration" || statement?.type === "ClassDeclaration") &&
        statement.id
    )
        return [statement.id.name];
    return [];
}

/**
 * Names a node binds for its own descendants, which shadow outer bindings
 * there. A `var` is treated as scoped to its block rather than hoisted.
 */
export function scopeNames(node: ESTree.Node): string[] {
    switch (node.type) {
        case "FunctionDeclaration":
        case "FunctionExpression":
        case "ArrowFunctionExpression":
            return node.params.flatMap(patternNames);
        case "CatchClause":
            return patternNames(node.param);
        case "BlockStatement":
        case "StaticBlock":
            return node.body.flatMap(declaredNames);
        case "SwitchStatement":
            return node.cases.flatMap(branch => branch.consequent.flatMap(declaredNames));
        case "ForStatement":
            return declaredNames(node.init);
        case "ForInStatement":
        case "ForOfStatement":
            return declaredNames(node.left);
        default:
            return [];
    }
}
