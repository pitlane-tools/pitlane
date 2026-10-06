import { render } from "remix/middleware/render";
import { createRouter, type MiddlewareContext } from "remix/router";

let renderMiddleware = render();
type AppContext = MiddlewareContext<[typeof renderMiddleware]>;

// The same app without the `routes` export, so `getStaticPaths()` has nothing
// to enumerate. Used to pin the error that reports it. Renders its own markup
// rather than <Document>, which reads assets for a server entry this build is
// not using.
export let router = createRouter<AppContext>({
    middleware: [renderMiddleware],
});

router.get("/", ({ render }) => render(<h1>Home</h1>));

export default router;
