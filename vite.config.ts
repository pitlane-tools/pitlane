import { defineConfig } from "vite-plus";

export default defineConfig({
    fmt: {
        ignorePatterns: [
            ".agents/docs/**",
            ".agents/skills/copyediting/**",
            ".agents/skills/remix/**",
            ".agents/skills/write-better-prose/**",
            "docs/SETUP.md",
            "docs/superpowers/**",
            "node_modules/**",
            "pitlane.md",
            "vite-plus.md",
        ],
        proseWrap: "never",
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
                files: ["**/*.jsonc"],
                options: { trailingComma: "none" },
            },
            {
                files: ["**/.vscode/**"],
                options: { trailingComma: "all" },
            },
        ],
    },
    lint: {
        ignorePatterns: [".agents/docs/**", "node_modules/**"],
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
