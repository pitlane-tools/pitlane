import path from "node:path";
import MagicString from "magic-string";
import type { Plugin } from "vite";

export function islandPlugin(): Plugin[] {
  let root = process.cwd();
  return [
    {
      name: "island",
      configResolved(config) {
        root = config.root;
      },
      transform: {
        handler(code, id) {
          if (this.environment.name !== "ssr") return;
          if (!id.includes("/islands/")) return;
          if (!/\.(t|j)sx?$/.test(id)) return;
          //
          // quick and dirty export wrapping transform
          // (more robust appraoch is found in https://github.com/vitejs/vite-plugin-react/blob/fffb7eb7a4d939783d1da09e2ca6368382735ca3/packages/plugin-rsc/src/transforms/wrap-export.ts#L24)
          //
          // [input]
          //   export function Counter() { ... }
          //
          // [output]
          //  function Counter() { ... }
          //  const __entry = await __resolver.getScriptEntry("src/islands/counter.tsx")
          //  const __wrap_Counter = __runtime.createIsland(Counter, "Counter", __entry)
          //  export { __wrap_Counter as Counter }
          //
          // The literal getScriptEntry argument is what registers the island
          // as a browser entry with @pitlane/assets; nothing else lists it.
          //
          const key = path.relative(root, id.split("?")[0]!).split(path.sep).join("/");
          const s = new MagicString(code);
          let wrappers = "";
          const matches = code.matchAll(
            /\b(export)\s+(function|const)\s+(\w+)/dg,
          );
          for (const match of matches) {
            const [exportStart, exportEnd] = match.indices![1]!;
            s.update(
              exportStart,
              exportEnd,
              " ".repeat(exportEnd - exportStart),
            );
            const exportName = match[3]!;
            wrappers +=
              `const __wrap_${exportName} = __runtime.createIsland(${exportName}, ${JSON.stringify(exportName)}, __entry);\n` +
              `export { __wrap_${exportName} as ${exportName} };\n`;
          }
          return `\
${s.toString()};
import { createAssetResolver as __createAssetResolver } from "@pitlane/assets";
import __manifest from "@pitlane/assets/manifest";
import * as __runtime from "/src/framework/island/runtime-server";
const __entry = await __createAssetResolver(__manifest).getScriptEntry(${JSON.stringify(key)});
${wrappers}`;
        },
      },
    },
    {
      name: "island:raw-import",
      transform: {
        order: "post",
        handler(code) {
          if (code.includes("__island_raw_import__")) {
            return code.replaceAll("__island_raw_import__", "import");
          }
        },
      },
    },
  ];
}
