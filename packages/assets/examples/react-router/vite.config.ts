import { assets } from "@pitlane/assets/vite-plugin";
import { fetchServer } from "@pitlane/vite-plugin-fetch-server";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        react(),
        // Chunk import maps are a plugin option, off by default. They are on
        // here so the document has to deliver the map; see src/entry.server.tsx.
        assets({ chunkImportMap: true }),
        fetchServer({ entry: "./src/entry.server.tsx" }),
    ],
    // There is no index.html for Vite to scan, so name the browser entry for
    // dependency pre-bundling; otherwise the first page load re-optimizes.
    optimizeDeps: { entries: ["src/entry.client.tsx"] },
    environments: {
        client: { build: { outDir: "dist/client" } },
        ssr: {
            build: {
                outDir: "dist/ssr",
                rolldownOptions: { input: { index: "./src/entry.server.tsx" } },
            },
        },
    },
});
