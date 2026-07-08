import { defineConfig } from "vite-plus";

import { remix } from "./remix.plugin.ts";

export default defineConfig({
    plugins: [remix({ clientEntry: false })],
    css: {
        transformer: "lightningcss",
    },
});
