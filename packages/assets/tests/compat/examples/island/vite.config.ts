import { assets } from "@pitlane/assets/vite-plugin";
import { fetchServer } from "@pitlane/vite-plugin-fetch-server";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { islandPlugin } from "./src/framework/island/plugin";

export default defineConfig({
    clearScreen: false,
    plugins: [
        preact(),
        islandPlugin(),
        assets({ chunkImportMap: process.env.COMPAT_CHUNK_IMPORT_MAP === "1" }),
        fetchServer({ entry: "./src/framework/entry.server.tsx" }),
    ],
    optimizeDeps: {
        entries: ["./src/framework/entry.client.tsx", "./src/islands/**/*"],
    },
    environments: {
        client: {
            build: { outDir: "./dist/client" },
        },
        ssr: {
            build: {
                outDir: "./dist/ssr",
                cssCodeSplit: false,
                rollupOptions: { input: { index: "./src/framework/entry.server.tsx" } },
            },
        },
    },
});
