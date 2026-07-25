// Runs only on asset misses (no `run_worker_first`): Cloudflare serves every
// matching static asset directly, with `html_handling: auto-trailing-slash`
// already canonicalizing HTML variants at the asset layer -
//   /guides/vite-plugin.html -> 307 /guides/vite-plugin
//   /guides/vite-plugin/     -> 307 /guides/vite-plugin
//   /package/dev             -> 307 /package/dev/ (directory index)
//
// What's left for this Worker:
//   1. Trailing slashes on non-HTML assets (/llms.txt/, /guides/vite-plugin.md/)
//      -> 307 to the real asset.
//   2. True misses -> the prerendered VitePress 404 page with a real 404
//      status (replaces the old `single-page-application` fallback, which
//      answered unknown URLs with the home shell and a 200).
interface Env {
    ASSETS: { fetch(input: Request | URL, init?: RequestInit): Promise<Response> };
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname !== "/" && url.pathname.endsWith("/")) {
            const canonical = new URL(url);
            canonical.pathname = url.pathname.replace(/\/+$/, "");
            const probe = await env.ASSETS.fetch(new Request(canonical, request));
            // The asset layer may itself answer with a canonicalizing
            // redirect (e.g. /foo.html/ -> probe /foo.html -> 307 /foo);
            // pass its Location through instead of adding a hop.
            if (probe.status >= 300 && probe.status < 400) return probe;
            if (probe.ok) return Response.redirect(canonical.href, 307);
        }

        const notFound = await env.ASSETS.fetch(new URL("/404.html", url));
        return new Response(notFound.body, {
            status: 404,
            headers: { "content-type": "text/html; charset=utf-8" },
        });
    },
};
