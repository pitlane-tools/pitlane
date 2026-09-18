import { headings } from "@pitlane/content/satteri";
import { content } from "@pitlane/content/vite";
import { remix } from "@pitlane/dev";
import { defineConfig } from "vite";
import satteri from "vite-plugin-satteri";

export default defineConfig({
    plugins: [
        // Sätteri compiles the Markdown bodies content() hands the bundler, so
        // it has to run before remix(). `headings` is the same plugin the
        // runtime path loads, which is what makes the two agree.
        satteri({ mdx: { jsxImportSource: "remix/ui" }, mdastPlugins: [headings()] }),
        content(),
        remix({ clientEntry: false }),
    ],
});
