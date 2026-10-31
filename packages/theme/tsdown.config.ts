import { defineConfig } from "tsdown";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        schema: "src/schema.ts",
        default: "src/default.ts",
        dtcg: "src/dtcg.ts",
    },
    dts: true,
});
