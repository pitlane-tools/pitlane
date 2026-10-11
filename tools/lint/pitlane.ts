import type { CreateRule, ESTree } from "@oxlint/plugins";

import { definePlugin } from "@oxlint/plugins";
import { dirname, matchesGlob, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// pluginModules are repo-relative, whichever directory Oxlint runs from.
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const BUNDLER =
    /^(vite|vite-plus|rolldown|rollup|esbuild|webpack)(\/|$)|^@(rolldown|rspack|voidzero-dev)\//;

interface NoBundlerImportsOptions {
    pluginModules: string[];
}

type ImportingNode =
    | ESTree.ImportDeclaration
    | ESTree.ExportNamedDeclaration
    | ESTree.ExportAllDeclaration
    | ESTree.ImportExpression
    | ESTree.TSImportType;

export let noBundlerImports: CreateRule = {
    meta: {
        type: "problem",
        docs: {
            description:
                "Keep bundler imports inside a package's /vite-plugin modules (policy.0006)",
        },
        schema: [
            {
                type: "object",
                properties: { pluginModules: { type: "array", items: { type: "string" } } },
                required: ["pluginModules"],
                additionalProperties: false,
            },
        ],
    },
    create(context) {
        let { pluginModules } = context.options[0] as unknown as NoBundlerImportsOptions;
        let isPluginModule = (file: string) =>
            pluginModules.some(glob => matchesGlob(relative(ROOT, file), glob));
        if (isPluginModule(context.filename)) return {};

        let inspect = ({ source }: ImportingNode) => {
            if (source?.type !== "Literal" || typeof source.value !== "string") return;
            let specifier = source.value;
            if (BUNDLER.test(specifier)) {
                context.report({
                    node: source,
                    message: `"${specifier}" is a bundler, which only the modules of a /vite-plugin subpath may import; move this code into one and list it in pluginModules (policy.0006)`,
                });
            } else if (
                specifier.startsWith(".") &&
                isPluginModule(resolve(dirname(context.filename), specifier))
            ) {
                context.report({
                    node: source,
                    message: `"${specifier}" is part of a Vite plugin integration, so importing it reaches the bundler from outside /vite-plugin (policy.0006)`,
                });
            }
        };
        return {
            ImportDeclaration: inspect,
            ExportNamedDeclaration: inspect,
            ExportAllDeclaration: inspect,
            ImportExpression: inspect,
            TSImportType: inspect,
        };
    },
};

export default definePlugin({
    meta: { name: "pitlane" },
    rules: { "no-bundler-imports": noBundlerImports },
});
