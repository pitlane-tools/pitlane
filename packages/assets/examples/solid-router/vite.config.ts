import { assets } from "@pitlane/assets/vite-plugin";
import { fetchServer } from "@pitlane/vite-plugin-fetch-server";
import solid from "@solidjs/vite-plugin";
import { globSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig({
    clearScreen: false,
    plugins: [
        // `ssr: true` only switches on the hydratable client and SSR server
        // transforms; this example supplies its own entries and server.
        solid({ ssr: true }),
        assets({
            // Chunk import maps are a plugin option, off by default. This
            // example turns them on so every document also has to deliver the map.
            chunkImportMap: true,
            // Every page is a browser entry, so the server can ask for a lazy
            // page's script URL with a key it computes. The pattern is the one
            // `src/router.ts` hands `import.meta.glob`.
            include: globSync("src/pages/*.tsx", { cwd: import.meta.dirname }),
        }),
        fetchServer({ entry: "./src/entry.server.tsx" }),
    ],
    environments: {
        client: { build: { outDir: "./dist/client" } },
        ssr: {
            build: {
                outDir: "./dist/ssr",
                rollupOptions: { input: { index: "./src/entry.server.tsx" } },
            },
        },
    },
});
