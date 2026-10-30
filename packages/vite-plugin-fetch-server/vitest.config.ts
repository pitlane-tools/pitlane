import { defineConfig } from "vitest/config";

export default defineConfig({
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
