import { cloudflare } from "@cloudflare/vite-plugin";
import { assets } from "@pitlane/assets/vite-plugin";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// Cloudflare owns request serving in dev and preview, so there is no Fetch
// server bridge here: the Worker reads the asset manifest like any module.
export default defineConfig({
    clearScreen: false,
    plugins: [
        react(),
        assets({ chunkImportMap: process.env.COMPAT_CHUNK_IMPORT_MAP === "1" }),
        cloudflare({ viteEnvironment: { name: "ssr" } }),
    ],
    optimizeDeps: {
        entries: ["./src/entry.client.tsx"],
    },
    environments: {
        client: {
            build: { outDir: "./dist/client" },
        },
        ssr: {
            build: {
                outDir: "./dist/ssr",
                rollupOptions: { input: { index: "./src/entry.server.tsx" } },
            },
        },
    },
    // Kept from upstream: the Cloudflare plugin would otherwise order the
    // builds itself, and the client build must follow server discovery.
    builder: {
        async buildApp(builder) {
            await builder.build(builder.environments["ssr"]!);
            await builder.build(builder.environments["client"]!);
        },
    },
});
