// Turns every exported function component under `src/islands/` into an island
// in the server build. For `export function Counter() {…}` in
// `src/islands/counter.tsx`, the server sees:
//
//     function Counter() {…}
//     const __entry = await __createAssetResolver(__manifest).getScriptEntry("src/islands/counter.tsx");
//     const __island_Counter = __createIsland(Counter, "Counter", __entry);
//     export { __island_Counter as Counter };
//
// The literal `getScriptEntry` call chained off `createAssetResolver()` is what
// registers the island module as a browser entry with `@pitlane/assets`;
// nothing else lists the islands. The `assets()` plugin reads it because it
// runs after this transform.
import type { Plugin } from "vite";

import MagicString from "magic-string";
import { relative, sep } from "node:path";

const EXPORTED_FUNCTION = /\bexport(\s+)function\s+(\w+)/dg;

export function islands(): Plugin {
    let root = process.cwd();
    return {
        name: "preact-islands",
        configResolved(config) {
            root = config.root;
        },
        transform(code, id) {
            if (this.environment.name !== "ssr") return;
            let file = id.split("?")[0]!;
            if (!/\/src\/islands\/[^/]+\.tsx$/.test(file)) return;

            let key = relative(root, file).split(sep).join("/");
            let s = new MagicString(code);
            let wrappers = "";
            for (let match of code.matchAll(EXPORTED_FUNCTION)) {
                // Drop `export` (and the whitespace after it) so the wrapper takes its place.
                let [start] = match.indices![0]!;
                let [, end] = match.indices![1]!;
                s.remove(start, end);
                let name = match[2]!;
                wrappers +=
                    `const __island_${name} = __createIsland(${name}, ${JSON.stringify(name)}, __entry);\n` +
                    `export { __island_${name} as ${name} };\n`;
            }
            if (!wrappers) return;

            s.append(`
import { createAssetResolver as __createAssetResolver } from "@pitlane/assets";
import __manifest from "@pitlane/assets/manifest";
import { createIsland as __createIsland } from "/src/island.ts";
const __entry = await __createAssetResolver(__manifest).getScriptEntry(${JSON.stringify(key)});
${wrappers}`);
            return { code: s.toString(), map: s.generateMap({ hires: true }) };
        },
    };
}
