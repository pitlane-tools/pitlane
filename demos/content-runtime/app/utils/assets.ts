import { createAssetServer } from "remix/assets";
import { uiHmr } from "remix/ui-hmr/assets";

let isDevelopment = process.env.NODE_ENV === "development";
// Only the child process `hmr.ts` supervises can open a channel back to it.
let isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR);

/**
 * The asset server, which is the whole build step this demo has.
 *
 * It compiles TypeScript and JSX on demand and serves the result, but it does
 * not rewrite bare specifiers: a served module still imports `remix/ui` by
 * name, and the import map each script entry carries is what resolves it.
 *
 * Under `pnpm dev` it also watches those files, instruments components so a
 * change hot-updates instead of reloading, and publishes the events through
 * the channel `hmr.ts` hosts. Under `pnpm start` none of that is constructed:
 * the same server minifies and fingerprints instead.
 */
export let assets = createAssetServer({
    basePath: "/assets",
    rootDir: process.cwd(),
    // Browser-reachable source lives under a `public/` directory beside its
    // owner. `remix` is allowed because the served modules import `remix/ui`
    // and its JSX runtime.
    allowFiles: ["app/**/public/**"],
    allowPackages: ["remix"],
    sourceMaps: isDevelopment ? "external" : undefined,
    minify: !isDevelopment,
    fingerprint: !isDevelopment,
    watch: isHmr,
    hmr: isHmr
        ? {
              channel: async () =>
                  (await import("remix/node-hmr/runtime")).createBrowserHmrChannel(),
              // The HMR client loads updated modules the same way the app does,
              // so it has to honour the per-entry import maps too.
              moduleImporter: "remix/multiple-import-maps-polyfill",
          }
        : undefined,
    scripts: { loaders: isHmr ? [uiHmr()] : undefined },
});
