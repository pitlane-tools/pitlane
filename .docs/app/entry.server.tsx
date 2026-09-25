import { render } from "remix/middleware/render";
import {
    createMiddleware,
    createRouter,
    type Middleware,
    type MiddlewareContext,
} from "remix/router";

import controller from "./controller.tsx";
import { documents } from "./documents.ts";
import { routes } from "./routes.ts";

/**
 * Keeps every response out of shared caches. A document is rendered with the
 * reader's preference cookies and a preference submission sets one; static
 * files never reach here.
 */
function privateResponses(): Middleware {
    return async (_context, next) => {
        let response = await next();
        let headers = new Headers(response.headers);
        headers.set("Cache-Control", "private, no-store");
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    };
}

let middleware = createMiddleware(privateResponses(), render());

type AppContext = MiddlewareContext<typeof middleware>;

declare module "remix/router" {
    interface RouterTypes {
        context: AppContext;
    }
}

let router = createRouter<AppContext>({ middleware });
router.map(routes, controller);

/** The Workers bindings this application reads; absent when the build renders it in Node. */
interface Env {
    ASSETS?: { fetch(request: Request): Promise<Response> };
}

export default {
    /**
     * The documentation. Cloudflare serves every file that exists before this
     * runs, so what arrives is a document, a preference submission, or a miss.
     * A miss with a trailing slash may still name a static file, which only the
     * asset binding can tell, so it redirects there instead of answering 404.
     */
    async fetch(request: Request, env?: Env): Promise<Response> {
        let response = await router.fetch(request);
        let url = new URL(request.url);
        if (
            response.status !== 404 ||
            !env?.ASSETS ||
            url.pathname === "/" ||
            !url.pathname.endsWith("/")
        ) {
            return response;
        }

        let file = new URL(url);
        file.pathname = url.pathname.replace(/\/+$/, "");
        let asset = await env.ASSETS.fetch(new Request(file, { method: "HEAD" }));
        let location = asset.ok ? file.pathname + file.search : asset.headers.get("location");
        if (!location || !(asset.ok || (asset.status >= 300 && asset.status < 400)))
            return response;

        await response.body?.cancel();
        return new Response(null, {
            status: 307,
            headers: { location, "cache-control": "private, no-store" },
        });
    },
};

/**
 * What the build's publication step reads from this same application: every
 * published document, whose pages it renders through `fetch` to write the
 * Markdown exports, LLM indexes, sitemap, and search index.
 */
export const publication = { documents };
