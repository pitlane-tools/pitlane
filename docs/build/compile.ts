import type { PluginOption } from "vite";

import { headings } from "@pitlane/content/satteri";
import { contentLayer } from "@pitlane/content/vite";
import { satteri } from "vite-plugin-satteri";

import { bindings } from "./bindings.ts";
import { expressiveAssets } from "./expressive-assets.ts";
import { codeBlocks, outline } from "./satteri.ts";

/**
 * What compiles the documentation's pages: the content layer over the
 * collections `entry` declares, and the pipeline every body it compiles, and
 * every partial a document imports, goes through: ids from the content
 * layer's slugger, then the documentation outline and Expressive Code. The
 * site and the installed documentation compile with this one list, so both
 * read the same pages.
 */
export function documentPlugins(entry: string): PluginOption[] {
    return [
        expressiveAssets(),
        satteri({
            mdx: { jsxImportSource: "remix/component" },
            mdastPlugins: [headings()],
            hastPlugins: [bindings(), outline(), codeBlocks()],
        }),
        contentLayer({ entry }),
    ];
}
