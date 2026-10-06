import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [remix({ clientEntry: false })],
    css: {
        transformer: "lightningcss",
    },
});
