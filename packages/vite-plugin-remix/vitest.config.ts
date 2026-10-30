import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        // @pitlane/crawler, @pitlane/assets, and @pitlane/vite-plugin-fetch-server
        // are sibling workspace packages: `mise run test:vite-plugin-remix` builds
        // them first. The fixtures load the plugin through a real Vite config
        // resolve, so a test-only source alias would not cover them.
        //
        // The e2e suites boot real in-process Vite servers (dev module runner,
        // preview, full builds). Run each file in its own forked child process
        // — plain-Node semantics — and keep files sequential so ports, cwd,
        // and the shared build-counter global never interleave.
        pool: "forks",
        isolate: true,
        fileParallelism: false,
        testTimeout: 120_000,
        hookTimeout: 120_000,
    },
});
