import { assets } from "@pitlane/assets/vite-plugin";
import { fetchServer } from "@pitlane/vite-plugin-fetch-server";
import { defineConfig } from "vite";

// Lit needs no Vite plugin: its templates and `css` are plain tagged templates.
export default defineConfig({
    clearScreen: false,
    plugins: [
        // Chunk import maps are a plugin option, off by default. This example
        // turns them on so every document with islands also delivers the map.
        assets({ chunkImportMap: true }),
        fetchServer({ entry: "./src/entry.server.ts" }),
    ],
    // Lets `vite dev` optimize Lit before the first page asks for an island,
    // instead of reloading the page once it discovers them.
    optimizeDeps: { entries: ["./src/islands/*.client.ts"] },
    environments: {
        client: { build: { outDir: "./dist/client" } },
        ssr: {
            build: {
                outDir: "./dist/ssr",
                rolldownOptions: { input: { index: "./src/entry.server.ts" } },
            },
        },
    },
});
