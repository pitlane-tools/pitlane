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

for (let route of [routes.home, routes.page, routes.pageWithSlash, routes.live]) {
    router.map(route, ({ render, request, url }: AppContext) => {
        if (request.method === "POST") return new Response("submitted", { status: 201 });
        if (request.headers.has("x-remix-frame") || request.headers.has("x-remix-target")) {
            return render(<p data-page={url.pathname}>Page: {url.pathname}</p>);
        }
        return render(
            <Document
                hasEnv={env !== undefined}
                pathname={url.pathname}
                userAgent={navigator.userAgent}
            />,
        );
    });
}

export { routes };
export default {
    async fetch(request: Request) {
        if (
            (request.method === "GET" || request.method === "HEAD") &&
            !request.headers.has("x-remix-frame") &&
            !request.headers.has("x-remix-target")
        ) {
            let asset = await env.ASSETS.fetch(request);
            if (asset.status !== 404) return asset;
        }
        return router.fetch(request);
    },
};

if (import.meta.hot) {
    import.meta.hot.accept();
}
