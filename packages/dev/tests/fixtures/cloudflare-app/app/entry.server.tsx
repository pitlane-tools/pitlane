// Importing cloudflare:workers makes this bundle resolvable only inside
// workerd — exactly what production looks like, and what the preview plugin's
// import-failure → skip contract exists for.
import { env } from "cloudflare:workers";
import { createRouter, type MiddlewareContext } from "remix/router";

import { Document } from "./document.tsx";
import { render, type RenderMiddleware } from "./render.tsx";
import { routes } from "./routes.ts";

type AppContext = MiddlewareContext<[RenderMiddleware]>;

declare module "remix/router" {
    interface RouterTypes {
        context: AppContext;
    }
}

export let router = createRouter<AppContext>({
    middleware: [render()],
});

router.map(routes.home, ({ render }) =>
    render(<Document hasEnv={env !== undefined} userAgent={navigator.userAgent} />),
);

export { routes };
export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
