// Server routes without server rendering. `remix/ui` is never imported here:
// the router answers data routes with JSON and every document route with the
// same shell, and the browser renders the app.
import { createRouter } from "remix/router";

import clientAssets from "./entry.browser.tsx?assets=client";
import { posts } from "./posts.ts";
import { routes } from "./routes.ts";

export let router = createRouter();

router.map(routes.posts, () => Response.json(posts));

function shell(): Response {
    return new Response(
        `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
            `<title>Client rendered</title>` +
            `<script type="module" src="${clientAssets.entry}"></script>` +
            `</head><body><div id="app"></div></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } },
    );
}

router.map(routes.home, shell);
router.map(routes.post, shell);

export default router;
