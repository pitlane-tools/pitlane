import { createAssetServer } from "remix/assets";
import { type MiddlewareContext, createRouter } from "remix/router";
import { get, route } from "remix/routes";

import controller from "#/actions/controller.tsx";
import { render } from "#/middleware/render.tsx";
import { routes } from "#/routes.ts";

type AppContext = MiddlewareContext<[ReturnType<typeof render>]>;

declare module "remix/router" {
    interface RouterTypes {
        context: AppContext;
    }
}

export let assets = createAssetServer({
    basePath: "/assets",
    rootDir: process.cwd(),
    // Browser-reachable source lives under a `public/` directory beside its
    // owner. `remix` is allowed because the served modules import
    // `remix/ui` and its JSX runtime.
    allowFiles: ["app/**/public/**"],
    allowPackages: ["remix"],
});

/**
 * The browser assets, resolved once at boot.
 *
 * Doing it here rather than per request keeps `Document` a dumb component, and
 * there is no request to wait for: the asset server can answer as soon as it
 * exists.
 */
export let browserAssets = {
    styles: await assets.getHref("app/public/index.css"),
    hydration: await assets.getScriptEntry("app/public/entry.browser.ts"),
    // Every browser module the page can hydrate has to be in the import map,
    // because the asset server compiles these modules but leaves their bare
    // `remix/ui` specifiers for the browser to resolve.
    importMap: await assets.getImportMap([
        "app/public/entry.browser.ts",
        "app/ui/public/counter.tsx",
    ]),
};

export let router = createRouter<AppContext>({ middleware: [render()] });

router.map(routes, controller);
let assetRoutes = route({ assets: get("/assets/*path") });

router.map(assetRoutes, {
    actions: {
        async assets({ request }) {
            return (await assets.fetch(request)) ?? new Response("Not found", { status: 404 });
        },
    },
});

export default router;
