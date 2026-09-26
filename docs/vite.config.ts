import { headings } from "@pitlane/content/satteri";
import { contentLayer } from "@pitlane/content/vite";
import { remix } from "@pitlane/dev";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { satteri } from "vite-plugin-satteri";

import { bindings } from "./build/bindings.ts";
import { expressiveAssets } from "./build/expressive-assets.ts";
import { publish } from "./build/publish.ts";
import { codeBlocks, outline } from "./build/satteri.ts";

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
        expressiveAssets(),
        // Every body the content layer compiles, and every partial a document
        // imports, goes through the same pipeline: ids from the content
        // layer's slugger, then the documentation outline and Expressive Code.
        satteri({
            mdx: { jsxImportSource: "remix/ui" },
            mdastPlugins: [headings()],
            hastPlugins: [bindings(), outline(), codeBlocks()],
        }),
        contentLayer({ entry: "app/content.ts" }),
        remix(),
        publish({
            site: SITE,
            generated: ".generated",
            moved: "./.generated/reference-redirects.json",
            server: "ssr",
        }),
    ],
});
