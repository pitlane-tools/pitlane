import { contentLayer } from "@pitlane/content/vite";
import { remix } from "@pitlane/dev";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { compileDocuments } from "./build/compile.ts";
import { expressiveAssets } from "./build/expressive-assets.ts";
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
    publicDir: "../docs/public",
    plugins: [
        expressiveAssets(),
        compileDocuments(),
        contentLayer({ entry: "app/content.ts" }),
        remix(),
        publish({
            site: SITE,
            generated: ".generated",
            moved: "../docs/.generated/reference-redirects.json",
            server: "ssr",
        }),
    ],
});
