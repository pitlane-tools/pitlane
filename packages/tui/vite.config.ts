import { defineConfig } from "vite-plus";

export default defineConfig({
    pack: [
        {
            entry: {
                index: "src/index.ts",
                node: "src/node.ts",
            },
            dts: { tsgo: true },
        },
    ],
    run: {
        tasks: {
            dev: { command: "vp pack --watch" },
            build: { command: "vp pack" },
        },
    },
    test: {
        include: ["src/**/*.test.ts"],
        // The tty engine parses a buffered lone ESC on its own clock inside
        // WASM, so a few suites wait out real latency windows.
        testTimeout: 20_000,
    },
});
