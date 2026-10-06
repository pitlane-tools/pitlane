import { defineConfig } from "@rsbuild/core";

import { pitlaneAssets } from "./pitlane-assets.ts";

export default defineConfig({
    // The server renders the document, so Rsbuild's generated HTML would be a second one.
    tools: { htmlPlugin: false },
    // Emit the SVG as a file rather than inline it, so `getHref` has a URL to return.
    output: { dataUriLimit: { svg: 0 } },
    environments: {
        web: {
            source: { entry: { client: "./src/client.ts" } },
            // ES module chunks: the entry imports its startup chunks, and lazy chunks load with import().
            output: { target: "web", module: true, distPath: { root: "dist/web" } },
            // A separate chunk for code the entry and the lazy module share, so the
            // entry has a static chunk dependency to preload.
            splitChunks: {
                cacheGroups: {
                    shared: {
                        test: /[\\/]src[\\/]shared\.ts$/,
                        name: "shared",
                        chunks: "all",
                        enforce: true,
                    },
                },
            },
        },
        node: {
            source: { entry: { server: "./src/server.ts" } },
            // Write the stylesheets the server imports, so they can be linked from its HTML.
            output: {
                target: "node",
                module: true,
                emitCss: true,
                distPath: { root: "dist/server" },
            },
        },
    },
    plugins: [pitlaneAssets()],
});
