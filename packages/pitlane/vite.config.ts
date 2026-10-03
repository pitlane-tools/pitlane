import { globSync } from "node:fs";
import { defineConfig } from "vite-plus";

// Every generated module is an entry, built to the same path under dist/.
// Declaration-only stubs have nothing to build and are copied as they are.
let modules = globSync("src/**/*.ts", { cwd: import.meta.dirname }).filter(
    path => !path.endsWith(".d.ts"),
);

export default defineConfig({
    pack: [
        {
            entry: Object.fromEntries(modules.map(path => [path.slice(4, -3), path])),
            dts: true,
            copy: [{ from: "src/**/*.d.ts", to: "dist", flatten: false }],
        },
    ],
    run: {
        tasks: {
            build: { command: ["rm -rf dist && vp pack", "node scripts/check-dist.ts"] },
            generate: {
                command: ["node scripts/generate.ts", "vp fmt package.json"],
                cache: false,
            },
        },
    },
    test: {
        include: ["tests/**/*.test.ts"],
    },
});
