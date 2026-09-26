import { cp, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vitepress";

import type { DocumentPage } from "./app/document.ts";

let pages = JSON.parse(
    await readFile(new URL("./.generated/documents.json", import.meta.url), "utf8"),
) as DocumentPage[];
let destinations = new Set(pages.map(page => page.url.replace(/\/$/, "")));
let root = fileURLToPath(new URL("../", import.meta.url));
let output = resolve(root, ".docs/.legacy-home");
await build(resolve(root, "docs"), {
    outDir: output,
    onAfterConfigResolve(config) {
        config.pages = ["index.md"];
        config.ignoreDeadLinks = [link => destinations.has(link.split("#")[0].replace(/\/$/, ""))];
    },
});
for (let name of [
    "index.html",
    "assets",
    "media",
    "icons",
    "favicon.svg",
    "logo-dark.svg",
    "logo-light.svg",
    "vp-icons.css",
]) {
    await cp(resolve(output, name), resolve(root, ".docs/dist/client", name), { recursive: true });
}
