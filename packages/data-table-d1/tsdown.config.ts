import { defineConfig } from "tsdown";

export default defineConfig({
    entry: { index: "src/index.ts", migrations: "src/migrations.ts" },
    dts: true,
});
