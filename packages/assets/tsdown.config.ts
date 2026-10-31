import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        manifest: "src/manifest.ts",
        build: "src/build.ts",
        "vite-plugin": "src/vite-plugin.ts",
    },
    dts: true,
});
