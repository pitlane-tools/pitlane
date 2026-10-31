import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        loaders: "src/loaders.ts",
        satteri: "src/satteri.ts",
        "vite-plugin": "src/vite-plugin.ts",
        hot: "src/hot.ts",
        manifest: "src/manifest.ts",
        prebuild: "src/prebuild.ts",
        codegen: "src/codegen.ts",
        mdx: "src/mdx.ts",
    },
    dts: true,
});
