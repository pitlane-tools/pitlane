import { createRedirectResponse } from "remix/response/redirect";
import { createController } from "remix/router";

import referenceRedirects from "../../docs/.generated/reference-redirects.json" with { type: "json" };
import { NotFound, Shell } from "./components/shell.tsx";
import { markdownPath } from "./document.ts";
import { type Documents, documents } from "./documents.ts";
import { readPreferences, submitPreference } from "./preferences.ts";
import { routes } from "./routes.ts";

/** Module pages the reference used to publish, by old path, and where each went. */
let moved = new Map<string, string>(Object.entries(referenceRedirects));

export default createController(routes, {
    actions: {
        /**
         * A document, rendered in full for this reader: the explicit URL picks
         * the page and its build-mode variant, the cookies everything else.
         */
        async document({ render, request, url }) {
            let published = await documents();
            let document = published.byUrl.get(url.pathname);
            if (!document) {
                let location = canonicalLocation(url, published);
                if (location) return createRedirectResponse(location, 307);
                return render(<NotFound preferences={await readPreferences(request)} />, {
                    status: 404,
                });
            }

            let [preferences, body] = await Promise.all([
                readPreferences(request),
                document.body(),
            ]);
            return render(
                <Shell page={document.page} pages={published.pages} preferences={preferences}>
                    {body}
                </Shell>,
            );
        },

        async preferences({ request }) {
            return submitPreference(request, (await documents()).byUrl);
        },
    },
});

/**
 * Where a path that is not itself a page leads, if anywhere: a page under a
 * spelling the old site served (a trailing slash, `.html`, `/index`, a module
 * page the reference has since renamed), or the Markdown counterpart of one
 * asked for with a trailing slash or by its module path.
 */
function canonicalLocation(url: URL, published: Documents): string | undefined {
    let path = url.pathname.replace(/\/+$/, "");
    let markdown = path.endsWith(".md");
    let normalized = path.replace(/\.(?:html|md)$/, "").replace(/\/index$/, "");
    let page = moved.get(normalized) ?? published.canonical.get(normalized);
    if (!page) return undefined;

    let pathname = markdown ? markdownPath(page) : page;
    return pathname === url.pathname ? undefined : pathname + url.search;
}
