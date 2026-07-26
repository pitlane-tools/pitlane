import { defineConfig } from "vite-plus";

export default defineConfig({
    pack: [
        {
            entry: { index: "src/index.ts" },
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
        include: ["**/*.test.ts"],
        typecheck: {
            enabled: true,
            checker: "tsc",
            tsconfig: "tsconfig.json",
        },
    },
});
