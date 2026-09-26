import { render } from "remix/middleware/render";
import { createMiddleware, createRouter, type MiddlewareContext } from "remix/router";

import controller from "./controller.tsx";
import { documents } from "./documents.ts";
import { routes } from "./routes.ts";

let middleware = createMiddleware(render());

type AppContext = MiddlewareContext<typeof middleware>;

declare module "remix/router" {
    interface RouterTypes {
        context: AppContext;
    }
}

let router = createRouter<AppContext>({ middleware });
router.map(routes, controller);

/** Development and build-time renderer; deployment serves only its prerendered output. */
export default router;

/**
 * What the build's publication step reads from this same application: every
 * published document, whose pages it renders through `fetch` to write their
 * HTML, Markdown exports, LLM indexes, sitemap, and search index.
 */
export const publication = { documents };
