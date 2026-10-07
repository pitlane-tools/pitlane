import { assets } from "@pitlane/assets/vite-plugin";
import { fetchServer } from "@pitlane/vite-plugin-fetch-server";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

import { islands } from "./islands-plugin.ts";

export default defineConfig({
    clearScreen: false,
    plugins: [
        preact(),
        islands(),
        // Chunk import maps are a plugin option, off by default. This example
        // turns them on so every document also has to deliver the map.
        assets({ chunkImportMap: true }),
        fetchServer({ entry: "./src/entry.server.ts" }),
    ],
    environments: {
        client: { build: { outDir: "./dist/client" } },
        ssr: {
            build: {
                outDir: "./dist/ssr",
                rollupOptions: { input: { index: "./src/entry.server.ts" } },
            },
        },
    },
});
