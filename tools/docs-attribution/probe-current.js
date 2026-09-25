/**
 * The probe, plus the real documentation Worker mounted under `/current/`.
 *
 * Place beside `.docs/dist/ssr/index.js` together with `probe.js`, and use
 * this file as the Worker's `main`. `/current/<path>` runs the deployed
 * application's own `fetch` for `<path>`, in the same isolate and the same
 * deployment as the probe cases, so the two are measured under identical
 * conditions. Everything under `/probe/` is the fixture.
 *
 * Kept separate from `probe.js` so the probe can be bundled and deployed on
 * its own when the documentation build is not present.
 */

import docsWorker from "./index.js";
import probe, { handleProbe, probeVersion } from "./probe.js";

export default {
    async fetch(request, env, ctx) {
        let url = new URL(request.url);

        if (url.pathname.startsWith("/probe/")) return handleProbe(request);

        if (url.pathname === "/current" || url.pathname.startsWith("/current/")) {
            let inner = new URL(url);
            inner.pathname = url.pathname.slice("/current".length) || "/";
            let response = await docsWorker.fetch(new Request(inner, request), env, ctx);
            let headers = new Headers(response.headers);
            headers.set("x-probe-case", "current-worker");
            headers.set("x-probe-version", probeVersion());
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers,
            });
        }

        return probe.fetch(request);
    },
};
