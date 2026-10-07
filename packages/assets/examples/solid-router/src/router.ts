import type { Component } from "solid-js";

import { createRouter } from "@solidjs/router";
import { lazy } from "solid-js";

declare module "@solidjs/router" {
    interface RouteInfo {
        /** The page module's portable source key, for the asset resolver. */
        source: string;
    }
}

// Every file in `pages/` is a lazy route: its chunk loads when the route first
// matches. `info.source` is what the server hands to the asset resolver for the
// routes a URL matches.
const pages = import.meta.glob<{ default: Component }>("./pages/*.tsx");

export const Router = createRouter({
    routes: Object.entries(pages).map(([file, load]) => {
        let name = file.slice("./pages/".length, -".tsx".length);
        return {
            path: name === "index" ? "/" : `/${name}`,
            component: lazy(load),
            info: { source: `src/${file.slice("./".length)}` },
        };
    }),
});
