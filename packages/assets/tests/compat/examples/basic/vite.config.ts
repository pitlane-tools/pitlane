import { assets } from "@pitlane/assets/vite-plugin";
import { fetchServer } from "@pitlane/vite-plugin-fetch-server";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    clearScreen: false,
    plugins: [
        react(),
        assets({ chunkImportMap: process.env.COMPAT_CHUNK_IMPORT_MAP === "1" }),
        fetchServer({ entry: "./src/entry.server.tsx" }),
    ],
    environments: {
        client: {
            build: { outDir: "./dist/client" },
            optimizeDeps: { entries: ["./src/entry.client.tsx"] },
        },
        ssr: {
            build: {
                outDir: "./dist/ssr",
                rollupOptions: { input: { index: "./src/entry.server.tsx" } },
            },
        },
    },
});
