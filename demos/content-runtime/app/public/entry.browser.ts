import {
    detectMultipleImportMapSupport,
    importModule,
    preloadShim,
} from "remix/multiple-import-maps-polyfill";
import { run } from "remix/ui";

/**
 * Hydrates the `clientEntry` components on the page.
 *
 * Every component carries its own import map, and a page with two of them
 * installs two. Browsers that cannot do that get the polyfill, which is why
 * modules load through `importModule` rather than a bare dynamic import, and
 * why a late component's preloads are fetched through `preloadShim` instead of
 * being left to the browser.
 */
let app = run({
    async loadModule(moduleUrl: string, exportName: string) {
        let module = await importModule(moduleUrl);
        let Component = module[exportName];
        if (typeof Component !== "function") {
            throw new Error(`Unknown component: ${moduleUrl}#${exportName}`);
        }
        return Component;
    },

    async processClientEntryPreloads(preloads) {
        if (await detectMultipleImportMapSupport()) return preloads;

        void preloadShim(preloads);
        return [];
    },
});

app.ready().catch((error: unknown) => {
    console.error("Frame adoption failed:", error);
});
