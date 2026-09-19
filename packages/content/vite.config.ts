import { defineConfig } from "vite-plus";

export default defineConfig({
    pack: [
        {
            entry: {
                index: "src/index.ts",
                loaders: "src/loaders.ts",
                satteri: "src/satteri.ts",
                vite: "src/vite.ts",
                hot: "src/hot.ts",
                manifest: "src/manifest.ts",
                prebuild: "src/prebuild.ts",
                codegen: "src/codegen.ts",
                mdx: "src/mdx.ts",
            },
            dts: true,
        },
    ],
    run: {
        tasks: {
            dev: { command: "vp pack --watch" },
            build: { command: "vp pack" },
        },
    },
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
