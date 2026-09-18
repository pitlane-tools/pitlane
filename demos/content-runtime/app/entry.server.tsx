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

let assets = createAssetServer({
    basePath: "/assets",
    rootDir: process.cwd(),
    allowFiles: ["app/**/public/**"],
});

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
