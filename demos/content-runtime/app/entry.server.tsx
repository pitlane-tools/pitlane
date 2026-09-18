import { asyncContext } from "remix/middleware/async-context";
import { render } from "remix/middleware/render";
import { type MiddlewareContext, createRouter } from "remix/router";

import controller from "#/actions/controller.tsx";
import { loadAssetEntry } from "#/middleware/asset-entry.ts";
import { routes } from "#/routes.ts";
import { assets } from "#/utils/assets.ts";

type AppContext = MiddlewareContext<[ReturnType<typeof loadAssetEntry>, ReturnType<typeof render>]>;

declare module "remix/router" {
    interface RouterTypes {
        context: AppContext;
    }
}

/**
 * `render({ assets })` is what makes a `clientEntry` component work without a
 * bundler. Its entry id is the `import.meta.url` of the file it lives in, and
 * the renderer hands that `file:` URL to the asset server, which answers with
 * the URL the browser loads, the modules to preload, and the import map that
 * resolves the bare specifiers inside it.
 */
export let router = createRouter<AppContext>({
    middleware: [asyncContext(), loadAssetEntry(), render({ assets })],
});

router.map(routes, controller);

export default router;
