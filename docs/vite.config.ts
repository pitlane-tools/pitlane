import { remix } from "@pitlane/dev";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { documentPlugins } from "./build/compile.ts";
import { publish } from "./build/publish.ts";

const SITE = {
    url: "https://pitlane.tools",
    name: "Pitlane",
    description: "Portable platform integration for Remix 3.",
};

export default defineConfig({
    // Anchored here rather than to the working directory: content paths
    // resolve against the root.
    root: fileURLToPath(new URL(".", import.meta.url)),
    publicDir: "./public",
    plugins: [
        ...documentPlugins("app/content.ts"),
        remix(),
        publish({
            site: SITE,
            generated: ".generated",
            moved: "./.generated/reference-redirects.json",
            server: "ssr",
        }),
    ],
});
