import type { Plugin } from "vite";

import { referenceCodeScripts, referenceCodeStyles } from "./expressive-code.ts";

const CSS = "virtual:reference-code.css";
const JS = "virtual:reference-code.js";

export function expressiveAssets(): Plugin {
    return {
        name: "docs-expressive-assets",
        resolveId(id) {
            if (id === CSS || id === JS) return `\0${id}`;
        },
        async load(id) {
            if (id === `\0${CSS}`) return referenceCodeStyles();
            if (id === `\0${JS}`) return referenceCodeScripts();
        },
    };
}
