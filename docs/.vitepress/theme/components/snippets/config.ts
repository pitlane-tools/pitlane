// @ts-nocheck
// vite.config.ts — the whole build config
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [remix()],
});
