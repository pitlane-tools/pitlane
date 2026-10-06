import { headings, rawStyles } from "@pitlane/content/satteri";
import { contentLayer } from "@pitlane/content/vite-plugin";
import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite";
import satteri from "vite-plugin-satteri";

export default defineConfig({
    plugins: [
        // Sätteri compiles the Markdown bodies contentLayer() hands the bundler,
        // so it has to run before remix(). Both plugins are the ones the runtime
        // path loads too, which is what makes the two agree.
        satteri({
            mdx: { jsxImportSource: "remix/component" },
            mdastPlugins: [headings()],
            hastPlugins: [rawStyles()],
        }),
        contentLayer(),
        remix(),
    ],
});
