import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite";

// remix() composes @pitlane/assets and the Fetch server bridge, recognizes
// clientEntry() islands, and wires Remix HMR.
export default defineConfig({
    clearScreen: false,
    plugins: [remix({ assets: { chunkImportMap: process.env.COMPAT_CHUNK_IMPORT_MAP === "1" } })],
});
