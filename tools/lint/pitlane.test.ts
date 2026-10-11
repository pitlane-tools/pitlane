import type { Context } from "@oxlint/plugins";

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { noBundlerImports } from "./pitlane.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PLUGIN_MODULES = ["packages/widget/src/vite-plugin.ts", "packages/widget/src/vite/**"];

type FakeNode = { type: string; [key: string]: unknown };
type FakeVisitor = Record<string, ((node: FakeNode) => void) | undefined>;

function lint(file: string, nodes: FakeNode[]): string[] {
    let messages: string[] = [];
    // The rule reads only these three members of its context.
    let context = {
        filename: join(ROOT, file),
        options: [{ pluginModules: PLUGIN_MODULES }],
        report: ({ message }: { message: string }) => messages.push(message),
    } as unknown as Context;
    let visitor = noBundlerImports.create(context) as FakeVisitor;
    for (let node of nodes) visitor[node.type]?.(node);
    return messages;
}

let literal = (value: string) => ({ type: "Literal", value });
let importing = (source: string, importKind = "value") => ({
    type: "ImportDeclaration",
    source: literal(source),
    importKind,
});

test("policy.0006: a runtime module importing a bundler, type-only included, is reported", () => {
    let messages = lint("packages/widget/src/index.ts", [
        importing("vite"),
        importing("vite/module-runner", "type"),
        { type: "ExportAllDeclaration", source: literal("rolldown/experimental") },
        { type: "ExportNamedDeclaration", source: literal("@voidzero-dev/vite-plus-core") },
        { type: "ImportExpression", source: literal("@rspack/core") },
        { type: "TSImportType", source: literal("esbuild") },
        importing("@rolldown/pluginutils"),
        importing("vite-plus/test"),
        importing("rollup"),
        importing("webpack"),
    ]);
    assert.equal(messages.length, 10);
    assert.equal(
        messages[0],
        '"vite" is a bundler, which only the modules of a /vite-plugin subpath may import; move this code into one and list it in pluginModules (policy.0006)',
    );
});

test("policy.0006: a runtime module importing a plugin module, statically or dynamically, is reported", () => {
    let messages = lint("packages/widget/src/runtime/load.ts", [
        importing("../vite-plugin.ts"),
        { type: "ImportExpression", source: literal("../vite/dev.ts") },
        { type: "ExportNamedDeclaration", source: literal("../vite/types.ts") },
    ]);
    assert.deepEqual(messages, [
        '"../vite-plugin.ts" is part of a Vite plugin integration, so importing it reaches the bundler from outside /vite-plugin (policy.0006)',
        '"../vite/dev.ts" is part of a Vite plugin integration, so importing it reaches the bundler from outside /vite-plugin (policy.0006)',
        '"../vite/types.ts" is part of a Vite plugin integration, so importing it reaches the bundler from outside /vite-plugin (policy.0006)',
    ]);
});

test("policy.0006: a plugin module may import bundlers and other plugin modules", () => {
    let nodes = [importing("vite"), importing("./state.ts"), importing("../vite-plugin.ts")];
    assert.deepEqual(lint("packages/widget/src/vite/dev.ts", nodes), []);
    assert.deepEqual(lint("packages/widget/src/vite-plugin.ts", [importing("vite")]), []);
});

test("policy.0006: runtime imports of runtime modules, other packages, and names that only resemble bundlers pass", () => {
    let messages = lint("packages/widget/src/index.ts", [
        importing("./manifest.ts"),
        importing("./vite-plugin-options.ts"),
        importing("remix/component"),
        importing("@pitlane/theme"),
        importing("vitest"),
        importing("rollup-plugin-visualizer"),
        importing("@vitejs/plugin-react-like"),
        { type: "ExportNamedDeclaration", source: null },
        { type: "ImportExpression", source: { type: "Identifier", name: "specifier" } },
    ]);
    assert.deepEqual(messages, []);
});
