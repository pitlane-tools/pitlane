import { defineConfig } from "vite-plus";

export default defineConfig({
    pack: [
        {
            entry: {
                index: "src/index.ts",
                hmr: "src/hmr-client.ts",
            },
            dts: true,
        },
    ],
    run: {
        tasks: {
            dev: { command: "vp pack --watch" },
            // Boots the HMR fixture's dev server for manual testing. Open the
            // printed URL, edit files under tests/fixtures/hmr-app/app, and watch
            // components hot-swap and server-only edits revalidate in place.
            harness: {
                command: "node tests/e2e/harness/dev-server.ts tests/fixtures/hmr-app 7411",
            },
            // The same, for the SPA-mode fixture. The :bundled variant runs
            // Vite's experimental bundled dev mode.
            "harness:spa": {
                command: "node tests/e2e/harness/dev-server.ts tests/fixtures/spa-app 7412",
            },
            "harness:spa:bundled": {
                command:
                    "node tests/e2e/harness/dev-server.ts tests/fixtures/spa-app 7412 --bundled",
            },
            build: {
                command: "rm -rf dist && vp pack",
            },
        },
    },
    test: {
        include: ["tests/**/*.test.ts"],
        // @pitlane/crawler, @pitlane/assets, and @pitlane/vite-plugin-fetch-server
        // are sibling workspace packages: build them before running these
        // suites (`vp run build` in each). The fixtures load the plugin through
        // a real Vite config resolve, so a test-only source alias would not
        // cover them.
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
