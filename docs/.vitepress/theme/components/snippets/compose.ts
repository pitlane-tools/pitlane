// @ts-nocheck
// vite.config.ts — swap the platform, keep the app
import { cloudflare } from "@cloudflare/vite-plugin";
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        remix({ serverHandler: false }),
        cloudflare({ viteEnvironment: { name: "ssr" } }),
    ],
});
