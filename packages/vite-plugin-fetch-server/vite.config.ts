import { defineConfig } from "vite-plus";

export default defineConfig({
    pack: [
        {
            entry: { index: "src/index.ts" },
            dts: true,
        },
    ],
    run: {
        tasks: {
            dev: { command: "vp pack --watch" },
            build: { command: "rm -rf dist && vp pack" },
        },
    },
    test: {
        include: ["tests/**/*.test.ts"],
        // Each test boots real Vite dev servers in child processes (see
        // tests/harness.ts). Keep files sequential so their servers and
        // temporary fixture copies never interleave.
        pool: "forks",
        fileParallelism: false,
        testTimeout: 60_000,
        hookTimeout: 60_000,
    },
});
