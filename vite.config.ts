import { defineConfig } from "vite-plus";

export default defineConfig({
    fmt: {
        ignorePatterns: [
            "docs/.vitepress/cache/**",
            "docs/.vitepress/dist/**",
            "docs/.vitepress/.temp/**",
            "docs/SETUP.md",
            "docs/superpowers/**",
            "node_modules/**",
            "packages/*/dist/**",
            "demos/*/dist/**",
            "pitlane.md",
            "vite-plus.md",
        ],
        printWidth: 100,
        tabWidth: 4,
        arrowParens: "avoid",
        sortPackageJson: true,
        sortImports: {
            groups: [
                "type-import",
                ["value-builtin", "value-external"],
                "type-internal",
                "value-internal",
                ["type-parent", "type-sibling", "type-index"],
                ["value-parent", "value-sibling", "value-index"],
                "unknown",
            ],
            partitionByComment: true,
        },
        overrides: [
            {
                files: [
                    "docs/.vitepress/theme/components/snippets/*.ts",
                    "docs/.vitepress/theme/components/snippets/*.tsx",
                ],
                options: {
                    printWidth: 55,
                },
            },
        ],
    },
    lint: {
        ignorePatterns: [
            "docs/.vitepress/cache/**",
            "docs/.vitepress/dist/**",
            "docs/.vitepress/theme/components/snippets/**",
            "node_modules/**",
            "packages/*/dist/**",
            "demos/*/dist/**",
            ".omp/**",
        ],
        options: {
            typeAware: true,
            typeCheck: true,
        },
        rules: {
            "typescript/no-floating-promises": "allow",
            "typescript/unbound-method": "allow",
            "import/extensions": [
                "error",
                "ignorePackages",
                {
                    cjs: "always",
                    cts: "always",
                    js: "always",
                    jsx: "always",
                    mjs: "always",
                    mts: "always",
                    ts: "always",
                    tsx: "always",
                },
            ],
        },
    },
});
