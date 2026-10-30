import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        hmr: "src/hmr-client.ts",
    },
    dts: true,
});
