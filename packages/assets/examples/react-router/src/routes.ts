import type { ComponentType } from "react";
import type { RouteObject } from "react-router";

interface RouteModule {
    Component: ComponentType;
}

// The glob is the only list of pages. Each route records its module's source
// key, so the server can ask the resolver for the assets of the routes a
// request matched; nothing else lists route assets.
const pages = import.meta.glob<RouteModule>("./**/page.tsx", { base: "./routes" });

export const routes: RouteObject[] = [
    {
        id: "root",
        path: "/",
        lazy: () => import("./layout.tsx"),
        handle: { source: "src/layout.tsx" },
        children: Object.entries(pages).map(([key, lazy]) => ({
            id: key,
            // "./blog/hello-world/page.tsx" => "blog/hello-world"; "./page.tsx" => ""
            path: key.slice(2).replace(/\/?page\.tsx$/, ""),
            lazy,
            handle: { source: `src/routes/${key.slice(2)}` },
        })),
    },
];
