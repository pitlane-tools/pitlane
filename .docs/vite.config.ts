import { cloudflare } from "@cloudflare/vite-plugin";
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

/** Publication derives exports and search from the built Worker's own document responses. */
export default defineConfig({
    // Anchored here rather than to the working directory: content paths
    // resolve against the root, and so does the Worker's configuration.
    root: fileURLToPath(new URL(".", import.meta.url)),
    publicDir: "../docs/public",
    plugins: [
        expressiveAssets(),
        compileDocuments(),
        contentLayer({ entry: "app/content.ts" }),
        remix({ serverHandler: false }),
        cloudflare({ configPath: "../wrangler.jsonc", viteEnvironment: { name: "ssr" } }),
        publish({ site: SITE, generated: ".generated", server: "ssr" }),
    ],
});
