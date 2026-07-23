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
            build: {
                command: "rm -rf dist && vp pack && cp src/assets.d.ts dist/assets.d.mts",
            },
        },
    },
    test: {
        include: ["tests/**/*.test.ts"],
        // The e2e suites boot real dev/preview servers and full builds; keep the
        // files sequential so ports, cwd, and the shared build-counter global
        // never interleave.
        fileParallelism: false,
        testTimeout: 120_000,
        hookTimeout: 120_000,
    },
})
