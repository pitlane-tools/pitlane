import { run } from "remix/ui";

/**
 * Hydrates the `clientEntry` components on the page.
 *
 * `loadModule` is how the runtime fetches the module a hydration marker names;
 * with a bundler those URLs are built assets, so an ordinary dynamic import is
 * all it takes.
 */
run({
    async loadModule(moduleUrl: string, exportName: string) {
        let module = (await import(/* @vite-ignore */ moduleUrl)) as Record<string, () => unknown>;
        return module[exportName]!;
    },
});
