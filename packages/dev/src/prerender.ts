import type { CrawlResult } from "@pitlane/crawler";
import type { RouteMap } from "remix/routes";
import type { ResolvedConfig, ViteBuilder } from "vite";

import { crawl, staticPaths } from "@pitlane/crawler";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";

/**
 * What a `prerender` function receives.
 */
export interface PrerenderContext {
    /**
     * Every path the app's route map can serve without params — `/` and
     * `/blog`, but not `/blog/:slug`, whose values live outside the route map.
     *
     * Reads the `routes` named export of the built server entry. Throws when
     * the server entry does not export one, since there is nothing else to
     * enumerate.
     */
    getStaticPaths(): string[];
}

/**
 * A function that decides which paths to prerender, for path sets that need
 * async work — a CMS query, a filesystem scan, a database read.
 */
export type PrerenderPaths = (
    context: PrerenderContext,
) => string[] | Promise<string[]> | Iterable<string> | Promise<Iterable<string>>;

/**
 * The paths to prerender: `true` for every static path in the route map, an
 * explicit list, or a function that computes one.
 */
export type PrerenderPathsOption = boolean | string[] | PrerenderPaths;

export interface PrerenderConfig {
    /**
     * The paths to prerender.
     *
     * @default true
     */
    paths?: PrerenderPathsOption;
    /**
     * How many paths to render at once. Rendering is CPU-bound in-process, so
     * the useful value depends on how much of a render waits on I/O.
     *
     * @default 1
     */
    concurrency?: number;
    /**
     * Also follow the links each rendered page contains, and prerender those
     * too. Turns the path list into a set of starting points rather than the
     * complete answer, which suits a site whose pages all link to each other.
     *
     * @default false
     */
    spider?: boolean;
}

export type PrerenderOption = PrerenderPathsOption | PrerenderConfig;

/**
 * The server entry contract, plus the optional route map a `prerender`
 * function needs for `getStaticPaths()`.
 */
interface ServerEntry {
    default?: { fetch(request: Request): Response | Promise<Response> };
    routes?: RouteMap;
}

function isPrerenderConfig(option: PrerenderOption): option is PrerenderConfig {
    return typeof option === "object" && !Array.isArray(option);
}

/**
 * Renders paths to static HTML at build time by dispatching requests through
 * the app's own fetch handler, then writing each response into the client
 * output. A host serves those files directly and the runtime server never sees
 * the request.
 *
 * Runs after both environments are built and the assets manifest is written,
 * so the server entry resolves real hashed client asset URLs — the HTML on
 * disk is the same HTML the runtime server would produce.
 *
 * @param builder The Vite builder mid-`buildApp`.
 * @param option The plugin's `prerender` option.
 * @returns The paths written, in completion order.
 */
export async function prerender(builder: ViteBuilder, option: PrerenderOption): Promise<string[]> {
    let config = isPrerenderConfig(option) ? option : { paths: option };
    let { paths = true, concurrency = 1, spider = false } = config;
    if (paths === false) return [];

    let ssrConfig = builder.environments.ssr?.config;
    let clientConfig = builder.environments.client?.config ?? ssrConfig;
    if (!ssrConfig || !clientConfig) {
        throw new Error("[@pitlane/dev] prerender needs both an ssr and a client environment.");
    }

    let entry = await loadServerEntry(ssrConfig);
    let handler = entry.default;
    if (!handler || typeof handler.fetch !== "function") {
        throw new Error(
            `[@pitlane/dev] prerender needs ${serverEntryPath(ssrConfig)} to default-export a ` +
                `fetch handler (an object with fetch(request: Request)), e.g. ` +
                `\`export default router\`.`,
        );
    }

    let resolved = await resolvePaths(paths, entry, ssrConfig);
    if (resolved.length === 0) return [];

    let outDir = path.resolve(clientConfig.root, clientConfig.build.outDir);
    let written: string[] = [];

    for await (let result of crawl(handler, {
        paths: resolved,
        spider,
        // Vite already emitted every asset the pages reference. Fetching them
        // back out of the router would duplicate the client build at best, and
        // fail the crawl on a 404 for apps that serve no static files.
        assets: false,
        concurrency,
    })) {
        written.push(await writeResult(result, outDir, clientConfig.base));
    }

    return written;
}

/**
 * Imports the built server entry. Dynamic by necessity: the specifier is a
 * runtime-computed path into the app's own build output.
 *
 * The bundle's modification time rides along in the URL. Node's module
 * registry is keyed on the specifier, so without it a second build in the same
 * process (a watch rebuild, or one test after another) would prerender through
 * the first build's handler.
 */
async function loadServerEntry(ssrConfig: ResolvedConfig): Promise<ServerEntry> {
    let entryPath = serverEntryPath(ssrConfig);
    try {
        let specifier = url.pathToFileURL(entryPath);
        specifier.searchParams.set("t", String((await fs.stat(entryPath)).mtimeMs));
        return (await import(/* @vite-ignore */ specifier.href)) as ServerEntry;
    } catch (error) {
        throw new Error(
            `[@pitlane/dev] prerender could not import ${entryPath}. Prerendering runs the ` +
                `server bundle in this Node process, so it cannot render a bundle built for ` +
                `another runtime (a Workers bundle importing \`cloudflare:workers\`, for one).`,
            { cause: error },
        );
    }
}

function serverEntryPath(ssrConfig: ResolvedConfig): string {
    return path.resolve(ssrConfig.root, ssrConfig.build.outDir, "index.js");
}

async function resolvePaths(
    // `false` is handled by the caller, which has nothing to render at all.
    paths: Exclude<PrerenderPathsOption, false>,
    entry: ServerEntry,
    ssrConfig: ResolvedConfig,
): Promise<string[]> {
    let getStaticPaths = () => {
        if (!entry.routes) {
            throw new Error(
                `[@pitlane/dev] prerender needs ${serverEntryPath(ssrConfig)} to export its ` +
                    `route map to enumerate static paths: \`export { routes } from ` +
                    `"./routes.ts"\` in your server entry. Pass an explicit path array instead ` +
                    `if the app has no route map.`,
            );
        }
        return staticPaths(entry.routes);
    };

    if (paths === true) return getStaticPaths();
    if (Array.isArray(paths)) return [...paths];
    return [...(await paths({ getStaticPaths }))];
}

/**
 * Writes one crawl result under the client output directory, returning the
 * path it wrote relative to that directory.
 *
 * `base` is stripped from the output path: a project deployed at `/repo/`
 * routes on `/repo/blog` but the file still belongs at `blog/index.html`,
 * because the host mounts the whole directory at the base.
 */
async function writeResult(result: CrawlResult, outDir: string, base: string): Promise<string> {
    let relative = stripBase(result.filepath, base).replace(/^\/+/, "");
    let outputPath = path.join(outDir, relative);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, new Uint8Array(await result.response.arrayBuffer()));

    return relative;
}

function stripBase(filepath: string, base: string): string {
    if (base === "/" || !base) return filepath;
    let prefix = base.endsWith("/") ? base.slice(0, -1) : base;
    return filepath.startsWith(`${prefix}/`) ? filepath.slice(prefix.length) : filepath;
}
