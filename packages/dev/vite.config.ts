import { defineConfig } from "vite-plus";

export default defineConfig({
    pack: [
        {
            entry: {
                index: "src/index.ts",
                runtime: "src/runtime.ts",
            },
            dts: { tsgo: true },
        },
    ],
    run: {
        tasks: {
            dev: { command: "vp pack --watch" },
            // Boots the HMR fixture's dev server for manual testing. Open the
            // printed URL, edit files under tests/fixtures/hmr-app/app, and watch
            // components hot-swap and server-only edits revalidate in place.
            harness: {
                command: "node tests/e2e/harness/dev-server.mjs tests/fixtures/hmr-app 7411",
            },
            build: {
                command: "rm -rf dist && vp pack && cp src/assets.d.ts dist/assets.d.mts",
            },
        },
    },
    test: {
        include: ["tests/**/*.test.ts"],
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
