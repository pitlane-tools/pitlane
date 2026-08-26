import type { RouteMap } from "remix/routes";
import type { ResolvedConfig } from "vite";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";
import { preview } from "vite";

/**
 * The server entry contract, plus the optional route map a `prerender`
 * function needs for `getStaticPaths()`.
 */
interface ServerEntry {
    default?: { fetch(request: Request): Response | Promise<Response> };
    routes?: RouteMap;
}

/**
 * Where prerender requests go, and the route map when the same mechanism
 * already has one.
 */
export interface PrerenderTarget {
    fetch(request: Request): Response | Promise<Response>;
    /**
     * The app's route map, read off the built bundle. Absent when the bundle
     * belongs to another runtime, which reaches the route map from source
     * instead.
     */
    routes?: RouteMap;
    /** Whether requests travel over a socket rather than in-process. */
    viaPreviewServer: boolean;
    close(): Promise<void>;
}

/**
 * Opens the built application for prerendering.
 *
 * The fast path imports the server bundle and calls its fetch handler in this
 * process: no socket, no second copy of the app, and the route map comes along
 * as a named export. A bundle built for another runtime cannot be imported
 * here — a Workers bundle opens with `import { env } from "cloudflare:workers"`
 * — so the fallback boots the project's own `vite preview` server and
 * dispatches over loopback. The platform's Vite plugin owns that server, so
 * pages still render inside the runtime that will serve them, and nothing in
 * the app has to name the runtime a second time.
 *
 * @param ssrConfig The resolved config of the `ssr` environment.
 */
export async function openTarget(ssrConfig: ResolvedConfig): Promise<PrerenderTarget> {
    let entry = await importServerEntry(ssrConfig);
    if (!entry) return openPreviewTarget(ssrConfig);

    let handler = entry.default;
    if (!handler || typeof handler.fetch !== "function") {
        throw new Error(
            `[@pitlane/dev] prerender needs ${serverEntryPath(ssrConfig)} to default-export a ` +
                `fetch handler (an object with fetch(request: Request)), e.g. ` +
                `\`export default router\`.`,
        );
    }

    return {
        fetch: request => handler.fetch(request),
        routes: entry.routes,
        viaPreviewServer: false,
        close: () => Promise.resolve(),
    };
}

export function serverEntryPath(ssrConfig: ResolvedConfig): string {
    return path.resolve(ssrConfig.root, ssrConfig.build.outDir, "index.js");
}

/**
 * Imports the built server entry, or reports that this process cannot.
 *
 * Dynamic by necessity: the specifier is a runtime-computed path into the
 * app's own build output. The bundle's modification time rides along in the
 * URL, because Node's module registry is keyed on the specifier — without it a
 * second build in the same process (a watch rebuild, or one test after
 * another) would prerender through the first build's handler.
 */
async function importServerEntry(ssrConfig: ResolvedConfig): Promise<ServerEntry | undefined> {
    let entryPath = serverEntryPath(ssrConfig);
    let stats = await fs.stat(entryPath).catch(() => undefined);
    if (!stats) {
        throw new Error(
            `[@pitlane/dev] prerender expected the server build at ${entryPath}, and found ` +
                `nothing there.`,
        );
    }

    try {
        let specifier = url.pathToFileURL(entryPath);
        specifier.searchParams.set("t", String(stats.mtimeMs));
        return (await import(/* @vite-ignore */ specifier.href)) as ServerEntry;
    } catch {
        // A bundle for another runtime. Rendering it is the preview server's
        // job, exactly as it is for `vite preview` itself.
        return undefined;
    }
}

/**
 * Boots the project's preview server and dispatches through it.
 *
 * `preview()` re-reads the project's config, so every plugin that contributes
 * a preview server gets to — `@cloudflare/vite-plugin` boots workerd with the
 * app's real bindings, and the same holds for any other platform plugin.
 */
async function openPreviewTarget(ssrConfig: ResolvedConfig): Promise<PrerenderTarget> {
    let server = await preview({
        root: ssrConfig.root,
        configFile: ssrConfig.configFile,
        logLevel: "silent",
        preview: { host: "127.0.0.1" },
    });

    let local = server.resolvedUrls?.local[0];
    if (!local) {
        await server.close();
        throw new Error(
            `[@pitlane/dev] prerender started a preview server to render ` +
                `${serverEntryPath(ssrConfig)} through, and it is not listening on any URL.`,
        );
    }

    // The URL carries the project's base; the crawler's paths already do too.
    let origin = new URL(local).origin;

    return {
        fetch(request) {
            let { pathname, search } = new URL(request.url);
            // In-process dispatch hands redirects to the crawler untouched, so
            // this transport must not resolve them either.
            return fetch(new URL(pathname + search, origin), { redirect: "manual" });
        },
        viaPreviewServer: true,
        close: () => server.close(),
    };
}
