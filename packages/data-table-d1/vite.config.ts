import { defineConfig } from "vite-plus";

export default defineConfig({
    pack: [
        {
            entry: { index: "src/index.ts", migrations: "src/migrations.ts" },
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
    },
});
