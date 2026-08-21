// Server routes without server rendering. The router answers data routes with
// JSON and every document route with the same shell, built out of `remix/ui`
// markup rather than a template literal, and the browser renders the app.
import { createHtmlResponse } from "remix/response/html";
import { createRouter } from "remix/router";
import { renderToString } from "remix/ui/server";

import { posts } from "./posts.ts";
import { routes } from "./routes.ts";
import { Shell } from "./shell.tsx";

export let router = createRouter();

router.map(routes.posts, () => Response.json(posts));

// `renderToString` renders the element tree; `createHtmlResponse` puts the
// DOCTYPE and the content type on it.
async function shell(): Promise<Response> {
    return createHtmlResponse(await renderToString(<Shell />));
}

router.map(routes.home, shell);
router.map(routes.post, shell);

export default router;
