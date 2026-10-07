import { assets } from "@pitlane/assets/vite-plugin";
import { fetchServer } from "@pitlane/vite-plugin-fetch-server";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        vue(),
        // Chunk import maps are an assets() option, off by default. This
        // example turns them on, so every document delivers the client's map.
        assets({ chunkImportMap: true }),
        fetchServer({ entry: "./src/entry.server.ts" }),
    ],
    // There is no index.html for Vite to crawl, so name the browser entry
    // to pre-bundle its dependencies before the first page load.
    optimizeDeps: { entries: ["src/entry.client.ts"] },
    environments: {
        client: { build: { outDir: "dist/client" } },
        ssr: {
            build: {
                outDir: "dist/ssr",
                rolldownOptions: { input: { index: "./src/entry.server.ts" } },
            },
        },
    },
});
