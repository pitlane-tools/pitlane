import type { ESTree } from "vite";

import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePath, parseSync } from "vite";

export interface BrowserInput {
    key: string;
    kind: "script" | "asset";
}

export function sourceKey(root: string, id: string): string {
    let file = id.split("?")[0].split("#")[0];
    if (file.startsWith("file://")) file = fileURLToPath(file);
    return normalizePath(relative(root, file));
}

export function inputPath(root: string, key: string): string {
    let path = key.split("#")[0];
    if (path.startsWith("file://")) return fileURLToPath(path);
    if (path.startsWith("file:")) path = path.slice(5);
    return resolve(root, path.replace(/^\/+/, ""));
}

export function fileModule(id: string): boolean {
    return !id.startsWith("\0") && isAbsolute(id.split("?")[0]);
}

export function discoverInputs(code: string, id: string): BrowserInput[] {
    if (!/\bget(?:ScriptEntry|Href)\s*\(/.test(code)) return [];
    let { program } = parseSync(id, code);
    let inputs: BrowserInput[] = [];
    let pending: unknown[] = [program];
    while (pending.length) {
        let node = pending.pop();
        if (!node || typeof node !== "object") continue;
        if (Array.isArray(node)) {
            pending.push(...node);
            continue;
        }
        let expression = node as ESTree.Node;
        if (expression.type === "CallExpression") {
            let { callee, arguments: args } = expression;
            if (
                callee.type === "MemberExpression" &&
                !callee.computed &&
                callee.property.type === "Identifier"
            ) {
                let method = callee.property.name;
                let argument = args[0];
                if (
                    (method === "getScriptEntry" || method === "getHref") &&
                    argument?.type === "Literal" &&
                    typeof argument.value === "string"
                ) {
                    inputs.push({
                        key: argument.value,
                        kind: method === "getScriptEntry" ? "script" : "asset",
                    });
                }
            }
        }
        for (let key in node) {
            let child = (node as Record<string, unknown>)[key];
            if (child && typeof child === "object") pending.push(child);
        }
    }
    return inputs;
}
