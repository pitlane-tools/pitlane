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

import { build, buildCompat, runtimeInline } from "./build.ts";
import { componentHmr, serverDataHmr } from "./hmr.ts";
import { preview } from "./preview.ts";
import { clientEntryTransform } from "./transform.ts";

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
     * @default true
     */
    serverHandler?: boolean;
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
 * keeping hydrated island state. Both are dev-only. Server-data HMR requires a
 * client entry, so it is skipped when `clientEntry` is `false`.
 *
 * Platform-agnostic by design: deploy targets compose alongside it in the
 * plugin array (`@cloudflare/vite-plugin`, `@netlify/vite-plugin`,
 * `nitro/vite`), or the built fetch handler runs directly on Node, Bun, and
 * Deno.
 */
export function remix(options: RemixPluginOptions = {}): PluginOption {
    let {
        clientEntry = "app/entry.browser",
        serverEntry = "app/entry.server",
        serverEnvironments = ["ssr"],
        serverHandler = true,
    } = options;

    let serverEnvironmentSet = new Set(serverEnvironments);

    return [
        fullstack({
            serverEnvironments,
            serverHandler,
        }),
        buildCompat(),
        build({ clientEntry, serverEntry }),
        runtimeInline(),
        preview(),
        suppressAbortErrors(),
        normalizeWriteHead(),
        componentHmr(serverEnvironmentSet),
        clientEntryTransform(serverEnvironmentSet),
        ...(clientEntry === false ? [] : [serverDataHmr(serverEnvironmentSet, clientEntry)]),
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
