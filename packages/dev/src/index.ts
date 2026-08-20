/**
 * The `remix()` Vite plugin — Remix 3 build orchestration, the `clientEntry()`
 * hydration transform, dev serving through the app's fetch handler, hot module
 * replacement for components and server-rendered data, and a preview server,
 * for any Vite or Vite+ project.
 *
 * @module @pitlane/dev
 */
import type { Plugin, PluginOption } from "vite";

import fullstack from "@hiogawa/vite-plugin-fullstack";

import type { PrerenderOption } from "./prerender.ts";

import { build, buildCompat, runtimeInline } from "./build.ts";
import { hmrComponent } from "./hmr-component.ts";
import { componentHmr, serverDataHmr } from "./hmr.ts";
import { preview } from "./preview.ts";
import { clientEntryTransform } from "./transform.ts";

export type {
    PrerenderConfig,
    PrerenderContext,
    PrerenderOption,
    PrerenderPaths,
    PrerenderPathsOption,
} from "./prerender.ts";

export interface RemixPluginOptions {
    /**
     * Client entry module, used as the client environment's build input.
     * Pass `false` to disable the client environment entirely (fully
     * server-rendered apps with no hydration).
     *
     * @default "app/entry.browser"
     */
    clientEntry?: string | false;
    /**
     * Whether the app has a server at all. Pass `false` for SPA mode: no
     * server environment is configured, nothing is built to `dist/ssr`, and
     * `vite build` emits a static site from `index.html`.
     *
     * This is about the server, not about server rendering. With `false`
     * every `server*` option below goes with it, because there is no server
     * for them to describe, and `clientEntry` goes too: the browser entry is
     * whatever `index.html` loads. An app that wants its UI rendered in the
     * browser while its routes still answer per request keeps `true` and
     * writes a server entry that serves data and a shell.
     *
     * @default true
     */
    server?: boolean;
    /**
     * Server entry module, built as `dist/ssr/index.js`. Must default-export
     * a fetch handler: an object exposing
     * `fetch(request: Request): Response | Promise<Response>`, e.g. a
     * `createRouter()` router.
     *
     * @default "app/entry.server"
     */
    serverEntry?: string;
    /**
     * Environment names the `clientEntry()` transform treats as "server".
     * In these environments the transform resolves the client chunk URL via a
     * `?assets=client` import.
     *
     * @default ["ssr"]
     */
    serverEnvironments?: string[];
    /**
     * Serve dev-server requests through the server entry's fetch handler.
     * Set to `false` when another plugin owns dev-time request handling —
     * e.g. `@cloudflare/vite-plugin`, `@netlify/vite-plugin`, or `nitro/vite`.
     *
     * Ignored when `server` is `false`, which has no fetch handler.
     *
     * @default true
     */
    serverHandler?: boolean;
    /**
     * Render paths to static HTML at build time and write them into the client
     * output, so a host can serve the file and skip the server entirely.
     *
     * `true` prerenders every static path in the app's route map, which the
     * server entry must export as `routes`. An array prerenders exactly those
     * paths. A function computes them, and receives `getStaticPaths()` for the
     * route-map half of a list that also has dynamic paths in it. The object
     * form adds `concurrency` and `spider`.
     *
     * Build-time only, and unsupported with `server: false`: prerendering
     * renders through the server entry, and there is none.
     *
     * @default undefined
     */
    prerender?: PrerenderOption;
}

/**
 * Wires Remix 3 into a Vite or Vite+ project: multi-environment build
 * orchestration (`dist/ssr` + `dist/client`), the
 * `clientEntry(import.meta.url, …)` hydration transform, dev serving through
 * the app's fetch handler, and a preview server for the production build.
 *
 * During `vite dev` it also installs hot module replacement: component edits
 * swap in place through the `remix/ui-hmr` transforms, and edits to modules the
 * browser never loads refetch the current page through the app's fetch handler,
 * keeping hydrated island state. Both are dev-only. The second half needs the
 * app to render `<HMR />` from the `pitlane:dev` module, which resolves to an
 * inert component in a build and when `clientEntry` is `false`.
 *
 * Platform-agnostic by design: deploy targets compose alongside it in the
 * plugin array (`@cloudflare/vite-plugin`, `@netlify/vite-plugin`,
 * `nitro/vite`), or the built fetch handler runs directly on Node, Bun, and
 * Deno.
 */
export function remix(options: RemixPluginOptions = {}): PluginOption {
    let {
        clientEntry = "app/entry.browser",
        server = true,
        serverEntry = "app/entry.server",
        serverEnvironments = ["ssr"],
        serverHandler = true,
        prerender,
    } = options;

    if (!server) {
        if (prerender !== undefined) {
            throw new Error(
                "[@pitlane/dev] remix({ server: false, prerender }) is not supported: " +
                    "prerendering renders through the server entry, and `server: false` builds " +
                    "no server. Drop `server: false` to prerender, or drop `prerender` to stay " +
                    "a SPA.",
            );
        }
        return spa();
    }

    let serverEnvironmentSet = new Set(serverEnvironments);

    return [
        fullstack({
            serverEnvironments,
            serverHandler,
        }),
        buildCompat(),
        build({ clientEntry, serverEntry, prerender }),
        runtimeInline(),
        preview(),
        suppressAbortErrors(),
        normalizeWriteHead(),
        componentHmr(serverEnvironmentSet),
        hmrComponent(clientEntry),
        clientEntryTransform(serverEnvironmentSet),
        serverDataHmr(serverEnvironmentSet),
    ];
}

/**
 * SPA mode: the subset of `remix()` that applies when there is no server.
 * Vite already serves `index.html` and builds it to a static site, so the only
 * thing left to wire is component hot module replacement — which a
 * client-rendered app wants just as much as a server-rendered one.
 *
 * Everything server-shaped is absent by construction: no server environment,
 * no `dist/ssr`, no dev fetch handler, and no server-data HMR (there is no
 * server data to revalidate, so `<HMR />` resolves to the inert component).
 */
function spa(): PluginOption {
    // Every environment is a client one, so no environment name is "server".
    let serverEnvironmentSet = new Set<string>();

    return [
        componentHmr(serverEnvironmentSet),
        hmrComponent(false),
        clientEntryTransform(serverEnvironmentSet),
    ];
}

/**
 * Suppresses `aborted` errors from client disconnects (e.g. search-as-you-type
 * or navigating away mid-fetch) that would otherwise trigger Vite's dev error
 * overlay. The match is deliberately narrow so real failures still propagate.
 */
function suppressAbortErrors(): Plugin {
    return {
        name: "pitlane-remix-suppress-abort-errors",
        configureServer(server) {
            return () => {
                server.middlewares.use(
                    // @ts-expect-error - connect error handlers require 4 args
                    (err, _req, _res, next) => {
                        if (err?.message === "aborted") return;
                        next(err);
                    },
                );
            };
        },
    };
}

/**
 * Flattens `[["key", "value"], …]` header arguments to the documented flat
 * form before they reach `res.writeHead`. Node tolerates nested pairs, but
 * runtimes implementing the documented `node:http` contract (Deno) reject
 * them — and dev-serving dependencies send pairs. Dev-only; production
 * responses never pass through this server.
 */
function normalizeWriteHead(): Plugin {
    return {
        name: "pitlane-remix-normalize-write-head",
        configureServer(server) {
            server.middlewares.use((_req, res, next) => {
                let original = res.writeHead.bind(res);
                res.writeHead = ((...args: Parameters<typeof res.writeHead>) => {
                    let last = args[args.length - 1];
                    if (Array.isArray(last) && last.every(entry => Array.isArray(entry))) {
                        args[args.length - 1] = last.flat();
                    }
                    return original(...args);
                }) as typeof res.writeHead;
                next();
            });
        },
    };
}
