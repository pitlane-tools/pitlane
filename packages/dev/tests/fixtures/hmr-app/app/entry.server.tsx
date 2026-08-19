import { staticFiles } from "remix/middleware/static";
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
    middleware: [staticFiles("./dist/client"), render()],
});

router.map(routes.home, ({ render }) => render(<Document />));
router.map(routes.claimed, ({ render }) => render(<Document claimed />));

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
