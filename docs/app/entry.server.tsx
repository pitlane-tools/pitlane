import { render } from "remix/middleware/render";
import { createMiddleware, createRouter, type MiddlewareContext } from "remix/router";

import type { Home } from "../build/exports.ts";

import { assets } from "./assets.ts";
import controller from "./controller.tsx";
import { documents } from "./documents.ts";
import { examples } from "./home/examples.ts";
import { SECTORS } from "./home/lap-sequence.ts";
import { description, platforms } from "./home/overview.ts";
import { routes } from "./routes.ts";

let middleware = createMiddleware(render({ assets }));

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
 * HTML, Markdown exports, LLM indexes, sitemap, and search index, and what
 * the home page shows, which its Markdown export says in prose.
 */
export const publication = {
    documents,
    home: {
        description,
        packages: examples,
        platforms: platforms.map(platform => ({
            ...platform,
            href: routes.deploy.href({ slug: platform.slug }),
        })),
        scaffold: SECTORS[0]!.command,
    } satisfies Home,
};
