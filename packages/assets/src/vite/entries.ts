import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePath } from "vite";

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
