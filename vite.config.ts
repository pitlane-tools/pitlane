import { defineConfig } from "vite-plus";

// TypeDoc's workspace package holds TypeScript 6, so its tasks run from there.
const TYPEDOC = ".typedoc";

export default defineConfig({
    fmt: {
        ignorePatterns: [
            ".agents/docs/**",
            ".agents/skills/copyediting/**",
            ".agents/skills/remix/**",
            ".agents/skills/write-better-prose/**",
            "docs/superpowers/**",
            "node_modules/**",
            // Oxfmt parses MDX as Markdown and escapes executable expressions.
            "**/*.mdx",
            "**/app/content/**",
            "packages/content/src/fixtures/**",
            "packages/content/tests/fixtures/**",
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
                files: ["**/*.md", "**/*.mdx"],
                options: { proseWrap: "never" },
            },
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
        ignorePatterns: [
            ".agents/docs/**",
            "node_modules/**",
            "packages/*/dist/**",
            "demos/*/dist/**",
            ".omp/**",
        ],
        options: {
            typeAware: true,
            typeCheck: true,
        },
        jsPlugins: ["eslint-plugin-perfectionist", "eslint-plugin-prefer-let"],
        rules: {
            "typescript/no-floating-promises": "allow",
            "typescript/unbound-method": "allow",
            "perfectionist/sort-jsx-props": "warn",
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
            "eslint/prefer-const": "off",
            "prefer-let/prefer-let": [2, { forceUpperCaseConst: true }],
        },
    },
    run: {
        tasks: {
            check: {
                dependsOn: [
                    "docs:build",
                    "docs:mdx",
                    "docs:test",
                    "docs:api:test",
                    "validate",
                    "tools:test",
                ],
                command: [
                    "vp check",
                    "tsc",
                    "tsc --project docs/tsconfig.json",
                    "tsc --project .typedoc/tsconfig.json",
                ],
            },
            typecheck: {
                dependsOn: ["docs:build"],
                command: [
                    "tsc",
                    "tsc --project docs/tsconfig.json",
                    "tsc --project .typedoc/tsconfig.json",
                ],
            },

            validate: "node tools/validate.ts",
            // Reads live git and GitHub state, which no input fingerprint covers.
            status: { command: "node tools/status.ts", cache: false },
            // The record tooling carries its own `node:test` suites so it stays
            // dependency-free. Package tests run through `vp test` from inside
            // each package, so this task is namespaced instead of claiming `test`.
            "tools:test": "node --test tools/*.test.ts",

            // Changesets can only format through a standalone Oxfmt config, so
            // `.changeset/config.json` turns that off and these tasks format the
            // files they write with the `fmt` block above.
            changeset: { command: ["changeset add", "vp fmt .changeset"], cache: false },
            "changeset:status": { command: "changeset status", cache: false },
            "changeset:version": {
                command: [
                    "changeset version",
                    "vp fmt",
                    "vp install --lockfile-only --ignore-scripts --no-frozen-lockfile",
                ],
                cache: false,
            },

            // The reader's workspace dependencies, built in dependency order.
            "docs:packages": "vp run --filter 'pitlane-docs^...' build",
            "docs:api": {
                dependsOn: ["docs:packages"],
                cwd: TYPEDOC,
                command: "node build.ts",
                cache: {
                    // Each run rewrites the pages and index the previous run wrote.
                    input: [{ auto: true }, "!docs/app/content/api/**", "!docs/.generated/**"],
                },
            },
            "docs:api:test": { cwd: TYPEDOC, command: "node --test plugin.test.ts" },
            // Typechecks authored MDX with its pinned language server.
            "docs:mdx": {
                dependsOn: ["docs:packages"],
                command: [
                    "node --test packages/mdx-checker/check.test.ts",
                    "node packages/mdx-checker/check.ts",
                ],
            },
            // `vp` runs the docs' own `vite`, which is Vite+ core, so plugins that
            // check a dev environment against their own Vite's classes see one
            // copy. Vite+ core ships no `vite` binary to call directly.
            "docs:build": {
                dependsOn: ["docs:api", "docs:mdx"],
                cwd: "docs",
                command: "vp build",
            },
            "docs:dev": {
                dependsOn: ["docs:build"],
                cwd: "docs",
                command: "vp dev --port 1337",
                cache: false,
            },
            "docs:test": {
                dependsOn: ["docs:build"],
                command: "node docs/test.ts",
                cache: {
                    // Wrangler's scratch state, which every run rewrites.
                    input: [{ auto: true }, "!.wrangler/**"],
                    output: [],
                },
            },
            // The last build's published files under Cloudflare's local runtime, as they deploy.
            "docs:serve": {
                command: "wrangler dev --config wrangler.jsonc --port 1337",
                cache: false,
            },
            "docs:prose": {
                command: [
                    "vale sync",
                    "vale docs/app/content/_partials docs/app/content/deployment docs/app/content/guides",
                ],
                cache: false,
            },

            "update-remix-skills": { command: "sh tools/update-remix-skills.sh", cache: false },
        },
    },
});
