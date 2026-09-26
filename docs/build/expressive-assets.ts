import type { Plugin } from "vite";

import { codeScripts, codeStyles } from "./expressive-code.ts";

const CSS = "virtual:expressive-code.css";
const JS = "virtual:expressive-code.js";

/**
 * Serves the stylesheet and browser script every Expressive Code example
 * shares as modules the browser entry imports, so Vite emits them with the
 * rest of its assets.
 */
export function expressiveAssets(): Plugin {
    return {
        name: "docs-expressive-assets",
        resolveId(id) {
            if (id === CSS || id === JS) return `\0${id}`;
        },
        async load(id) {
            if (id === `\0${CSS}`) return codeStyles();
            if (id === `\0${JS}`) return codeScripts();
        },
    };
}
