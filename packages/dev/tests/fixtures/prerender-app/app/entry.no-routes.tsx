import { createRouter, type MiddlewareContext } from "remix/router";

import { render, type RenderMiddleware } from "./render.tsx";

type AppContext = MiddlewareContext<[RenderMiddleware]>;

// The same app without the `routes` export, so `getStaticPaths()` has nothing
// to enumerate. Used to pin the error that reports it. Renders its own markup
// rather than <Document>, which would pull in `?assets=ssr` for a server entry
// this build is not using.
export let router = createRouter<AppContext>({
    middleware: [render()],
});

router.get("/", ({ render }) => render(<h1>Home</h1>));

export default router;
