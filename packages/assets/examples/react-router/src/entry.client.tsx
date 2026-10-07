import "@vitejs/plugin-react/preamble";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter, matchRoutes } from "react-router";
import { RouterProvider } from "react-router/dom";

import { routes } from "./routes.ts";

// Load the matched routes' lazy modules before hydrating, so the first client
// render is the tree the server rendered.
let matches = matchRoutes(routes, window.location) ?? [];
await Promise.all(
    matches.map(async ({ route }) => {
        if (typeof route.lazy !== "function") return;
        Object.assign(route, { ...(await route.lazy()), lazy: undefined });
    }),
);

// Reads the loader data StaticRouterProvider wrote into the page.
let router = createBrowserRouter(routes);

startTransition(() => {
    hydrateRoot(
        document.getElementById("root")!,
        <StrictMode>
            <RouterProvider router={router} />
        </StrictMode>,
    );
});
