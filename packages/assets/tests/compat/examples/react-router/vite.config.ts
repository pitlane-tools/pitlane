import { assets } from "@pitlane/assets/vite-plugin";
import { fetchServer } from "@pitlane/vite-plugin-fetch-server";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";

export default defineConfig({
    clearScreen: false,
    plugins: [
        react(),
        devtoolsJson(),
        assets({ chunkImportMap: process.env.COMPAT_CHUNK_IMPORT_MAP === "1" }),
        fetchServer({ entry: "./src/framework/entry.server.tsx" }),
    ],
    optimizeDeps: {
        entries: ["src/framework/entry.client.tsx"],
    },
    environments: {
        client: {
            build: { outDir: "./dist/client" },
        },
        ssr: {
            build: {
                outDir: "./dist/ssr",
                rollupOptions: { input: { index: "./src/framework/entry.server.tsx" } },
            },
        },
    },
});
