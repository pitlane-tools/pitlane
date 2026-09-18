import { run } from "remix/ui";

/**
 * Hydrates the `clientEntry` components on the page.
 *
 * `loadModule` fetches the module a hydration marker names. With no bundler
 * those URLs are asset-server paths, so a plain dynamic import is all it takes.
 */
run({
    async loadModule(moduleUrl: string, exportName: string) {
        let module = (await import(moduleUrl)) as Record<string, () => unknown>;
        return module[exportName]!;
    },
});
