/**
 * The `remix()` Vite plugin — Remix 3 build orchestration, the `clientEntry()`
 * island identity transform, dev serving through the app's fetch handler, hot
 * module replacement for components and server-rendered data, prerendering,
 * and a preview server, for any Vite or Vite+ project.
 *
 * @see {@link https://pitlane.tools/guides/vite-plugin | Vite plugin guide}
 * @see {@link https://pitlane.tools/guides/hmr | Hot module replacement guide}
 * @see {@link https://pitlane.tools/guides/spa | Single-page apps guide}
 * @see {@link https://pitlane.tools/guides/prerendering | Prerendering guide}
 *
 * @module @pitlane/vite-plugin-remix
 */
import type { AssetsPluginOptions } from "@pitlane/assets/vite-plugin";
import type { Plugin, PluginOption, UserConfig } from "vite";

import { assets } from "@pitlane/assets/vite-plugin";
import { fetchServer } from "@pitlane/vite-plugin-fetch-server";

import type { PrerenderOption } from "./prerender.ts";

import { build } from "./build.ts";
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

/**
 * The options {@link remix} accepts. Every one has a default, and most
 * projects pass none.
 *
 * @see {@link https://pitlane.tools/guides/vite-plugin#options | Vite plugin guide: Options}
 */
export interface RemixPluginOptions {
    /**
     * Browser script entry, used as the client environment's build input.
     * Pass `false` for fully server-rendered apps with no hydration: no
     * browser script is built, while stylesheets and assets the server
     * registers still go to `dist/client`.
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
     * for them to describe, and `clientEntry` and `assets` go too: the browser
     * entry is whatever `index.html` loads. An app that wants its UI rendered
     * in the browser while its routes still answer per request keeps `true`
     * and writes a server entry that serves data and a shell.
     *
     * @default true
     */
    server?: boolean;
    /**
     * Server entry module, built as `dist/ssr/index.js` and loaded for every
     * dev request. Must default-export a fetch handler: an object exposing
     * `fetch(request: Request): Response | Promise<Response>`, e.g. a
     * `createRouter()` router.
     *
     * @default "app/entry.server"
     */
    serverEntry?: string;
    /**
     * Environment names treated as "server": islands are discovered and
     * stylesheets collected while they build, and hot module replacement
     * classifies their modules as server code. Dev requests run in the first.
     *
     * @default ["ssr"]
     */
    serverEnvironments?: string[];
    /**
     * Serve dev-server and `vite preview` requests through the server entry's
     * fetch handler. Set to `false` when another plugin owns request handling
     * — `@cloudflare/vite-plugin` (workerd) or `nitro/vite` — so its own
     * preview serves the build, even one Node could import. Keep the default
     * with `@netlify/vite-plugin`, which emulates platform primitives around
     * the dev server but leaves SSR to the app's fetch handler.
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
    /**
     * Options for the asset plugin `remix()` installs: `include` for browser
     * entries the server names with computed paths, `chunkImportMap`, which
     * `remix()` turns on unless this option or Vite's own
     * `build.chunkImportMap` says otherwise, and `allowFiles`,
     * `allowPackages`, and `denyFiles` for the browser boundary. Server
     * environments come from `serverEnvironments`.
     *
     * Ignored when `server` is `false`.
     *
     * @default {}
     */
    assets?: Omit<AssetsPluginOptions, "serverEnvironments">;
}

/**
 * Wires Remix 3 into a Vite or Vite+ project: multi-environment builds
 * (`dist/ssr` + `dist/client`) with an asset manifest for
 * `createAssetResolver()`, portable `clientEntry(import.meta.url, …)` island
 * identities that `render({ assets })` resolves, dev serving through the app's
 * fetch handler, prerendering, and a preview server for the production build.
 *
 * During `vite dev` it also installs hot module replacement: component edits
 * swap in place through the `remix/component-hmr` transforms, and edits to
 * modules the browser never loads broadcast a `server:update` event. An app
 * whose browser entry passes its `run()` runtime to `revalidate` from
 * `@pitlane/vite-plugin-remix/hmr` on that event refetches the current page
 * through the app's fetch handler, keeping hydrated island state. Both are
 * dev-only.
 *
 * Platform-agnostic by design: deploy targets compose alongside it in the
 * plugin array (`@cloudflare/vite-plugin`, `@netlify/vite-plugin`,
 * `nitro/vite`), or the built fetch handler runs directly on Node, Bun, and
 * Deno.
 *
 * @param options - Entry modules, SPA mode, prerendering, assets, and dev serving; see {@link RemixPluginOptions}
 * @returns The plugins, passed to Vite as one entry of `plugins`
 * @throws Error when `server: false` is combined with `prerender`
 *
 * @see {@link https://pitlane.tools/guides/vite-plugin | Vite plugin guide}
 * @see {@link https://pitlane.tools/guides/hmr | Hot module replacement guide}
 * @see {@link https://pitlane.tools/guides/spa | Single-page apps guide}
 * @see {@link https://pitlane.tools/guides/prerendering | Prerendering guide}
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { remix } from "@pitlane/vite-plugin-remix";
 * import { defineConfig } from "vite";
 *
 * export default defineConfig({
 *     plugins: [remix()],
 * });
 * ```
 *
 * @example SPA mode, with no server and index.html as the entry
 * ```ts
 * // vite.config.ts
 * import { remix } from "@pitlane/vite-plugin-remix";
 * import { defineConfig } from "vite";
 *
 * export default defineConfig({
 *     plugins: [remix({ server: false })],
 * });
 * ```
 */
export function remix(options: RemixPluginOptions = {}): PluginOption {
    let {
        clientEntry = "app/entry.browser",
        server = true,
        serverEntry = "app/entry.server",
        serverEnvironments = ["ssr"],
        serverHandler = true,
        prerender,
        assets: assetsOptions = {},
    } = options;

    if (!server) {
        if (prerender !== undefined) {
            throw new Error(
                "[@pitlane/vite-plugin-remix] remix({ server: false, prerender }) is not " +
                    "supported: prerendering renders through the server entry, and " +
                    "`server: false` builds no server. Drop `server: false` to prerender, or " +
                    "drop `prerender` to stay a SPA.",
            );
        }
        return spa(assetsOptions.chunkImportMap);
    }

    let serverEnvironmentSet = new Set(serverEnvironments);

    return [
        assetsOptions.chunkImportMap === undefined && chunkImportMapDefault(),
        assets({ ...assetsOptions, serverEnvironments }),
        serverHandler && fetchServer({ entry: serverEntry, environment: serverEnvironments[0] }),
        build({ clientEntry, serverEntry, prerender }),
        serverHandler && preview(),
        componentHmr(serverEnvironmentSet),
        clientEntryTransform(serverEnvironmentSet),
        serverDataHmr(serverEnvironmentSet),
    ];
}

/**
 * SPA mode: the subset of `remix()` that applies when there is no server.
 * Vite already serves `index.html` and builds it to a static site, so the only
 * things left to wire are component hot module replacement — which a
 * client-rendered app wants just as much as a server-rendered one — and the
 * chunk import map default, which Vite writes into `index.html` itself.
 *
 * Everything server-shaped is absent by construction: no server environment,
 * no `dist/ssr`, no dev fetch handler, no asset manifest, and no server-data
 * HMR (there is no server data to revalidate, so no server update is ever
 * broadcast).
 */
function spa(chunkImportMap: boolean | undefined): PluginOption {
    // Every environment is a client one, so no environment name is "server".
    let serverEnvironmentSet = new Set<string>();

    return [
        chunkImportMap === undefined
            ? chunkImportMapDefault()
            : { name: "pitlane-remix-chunk-import-map", config: () => clientMaps(chunkImportMap) },
        componentHmr(serverEnvironmentSet),
        clientEntryTransform(serverEnvironmentSet),
    ];
}

function clientMaps(chunkImportMap: boolean): UserConfig {
    return { environments: { client: { build: { chunkImportMap } } } };
}

/**
 * Turns chunk import maps on for the client build when neither
 * `remix({ assets: { chunkImportMap } })` nor Vite's own `build.chunkImportMap`
 * chooses. A Remix document renders `<ImportMap>`, so the map has somewhere to
 * go; `assets()` itself still defaults to off. It runs before the `post`
 * `assets()` config hook, which then reads the native setting this supplies.
 */
function chunkImportMapDefault(): Plugin {
    return {
        name: "pitlane-remix-chunk-import-map",
        config(config) {
            let native =
                config.environments?.client?.build?.chunkImportMap ?? config.build?.chunkImportMap;
            if (native !== undefined) return;
            return clientMaps(true);
        },
    };
}
