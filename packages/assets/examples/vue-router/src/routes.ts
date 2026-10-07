import type { RouteComponent, RouteRecordRaw } from "vue-router";

import Layout from "./layout.vue";

// Every file in `pages/` is a lazy route: Vue Router loads its chunk when the
// route first matches. `meta.source` is the page's portable source key, which
// the server hands to the asset resolver for the matched routes.
let pages = import.meta.glob<RouteComponent>("./pages/*.vue", { import: "default" });

export let routes: RouteRecordRaw[] = [
    {
        path: "/",
        component: Layout,
        children: Object.entries(pages).map(([file, component]) => {
            let name = file.slice("./pages/".length, -".vue".length);
            return {
                path: name === "index" ? "" : name,
                component,
                meta: { source: `src/${file.slice("./".length)}` },
            };
        }),
    },
];
