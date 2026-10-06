import { render } from "remix/middleware/render";
import { staticFiles } from "remix/middleware/static";
import { createRouter, type MiddlewareContext } from "remix/router";

import { assets } from "./assets.ts";
import { Document } from "./document.tsx";
import { routes } from "./routes.ts";

let renderMiddleware = render({ assets });
type AppContext = MiddlewareContext<[typeof renderMiddleware]>;

declare module "remix/router" {
    interface RouterTypes {
        context: AppContext;
    }
}

export let router = createRouter<AppContext>({
    middleware: [staticFiles("./dist/client"), renderMiddleware],
});

router.map(routes.home, ({ render }) => render(<Document />));

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
