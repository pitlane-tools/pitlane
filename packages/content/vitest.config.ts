import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["**/*.test.ts"],
        // tests/ boots real in-process Vite builds and dev servers. Give each
        // file its own forked child and keep files sequential so watchers,
        // temp directories, and cwd never interleave.
        pool: "forks",
        isolate: true,
        fileParallelism: false,
        testTimeout: 60_000,
        hookTimeout: 60_000,
    },
});
