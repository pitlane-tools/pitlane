import { render } from "remix/middleware/render";
import { type MiddlewareContext, createRouter } from "remix/router";

import controller from "#/actions/controller.tsx";
import { routes } from "#/routes.ts";

type AppContext = MiddlewareContext<[ReturnType<typeof render>]>;

declare module "remix/router" {
    interface RouterTypes {
        context: AppContext;
    }
}

export let router = createRouter<AppContext>({ middleware: [render()] });

router.map(routes, controller);

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
