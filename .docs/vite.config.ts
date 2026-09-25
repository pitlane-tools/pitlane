import { cloudflare } from "@cloudflare/vite-plugin";
import { contentLayer } from "@pitlane/content/vite";
import { remix } from "@pitlane/dev";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { compileDocuments } from "./build/compile.ts";
import { publish } from "./build/publish.ts";

const SITE = {
    url: "https://pitlane.tools",
    name: "Pitlane",
    description: "Portable platform integration for Remix 3.",
};

/**
 * One application, built once: `compileDocuments()` turns every Markdown and
 * MDX body into a component module, `contentLayer()` inlines the collections'
 * metadata, `remix()` builds the server entry and the browser entry, and
 * Cloudflare's plugin makes the server entry the Worker, in development too.
 * `publish()` then renders the built Worker's pages into the static Markdown
 * exports, LLM indexes, sitemap, and search index.
 */
export default defineConfig({
    // Anchored here rather than to the working directory: content paths
    // resolve against the root, and so does the Worker's configuration.
    root: fileURLToPath(new URL(".", import.meta.url)),
    publicDir: "../docs/public",
    plugins: [
        compileDocuments(),
        contentLayer({ entry: "app/content.ts" }),
        remix({ serverHandler: false }),
        cloudflare({ configPath: "../wrangler.jsonc", viteEnvironment: { name: "ssr" } }),
        publish({ site: SITE, generated: ".generated", server: "ssr" }),
    ],
});
