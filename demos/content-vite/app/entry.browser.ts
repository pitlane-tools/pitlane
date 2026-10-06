import { revalidate } from "@pitlane/dev/hmr";
import { run } from "remix/component";

/**
 * Hydrates the `clientEntry` components on the page.
 *
 * `loadModule` is how the runtime fetches the module a hydration marker names;
 * with a bundler those URLs are built assets, so an ordinary dynamic import is
 * all it takes.
 */
let app = run({
    async loadModule(moduleUrl: string, exportName: string) {
        let module = (await import(/* @vite-ignore */ moduleUrl)) as Record<string, () => unknown>;
        return module[exportName]!;
    },
});

// Server-only edits during `vite dev` refetch the page in place.
if (import.meta.hot) {
    import.meta.hot.on("server:update", () => revalidate(app));
}
