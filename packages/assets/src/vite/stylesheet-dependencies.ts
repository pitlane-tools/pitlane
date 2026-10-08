import type { Environment, ResolvedConfig } from "vite";

/**
 * Calls `observe` with every file Vite's CSS plugin reads into a stylesheet:
 * `@import`ed stylesheets, preprocessor partials, and `url()` targets, emitted
 * or inlined. A build's module graph records none of them; Vite reports them
 * only as watch files, so this wraps the context of the plugin's transform.
 */
export function observeStylesheetDependencies(
    config: ResolvedConfig,
    observe: (environment: Environment, stylesheet: string, file: string) => void,
): void {
    let hook = config.plugins.find(plugin => plugin.name === "vite:css")?.transform;
    if (typeof hook !== "object") {
        throw new Error(
            "[assets] This Vite version does not expose the CSS transform the browser boundary reads. Use a supported Vite version.",
        );
    }
    let handler = hook.handler;
    hook.handler = function (code, id, options) {
        let context = new Proxy(this, {
            get(target, property) {
                if (property === "addWatchFile") {
                    return (file: string) => {
                        observe(target.environment, id, file);
                        target.addWatchFile(file);
                    };
                }
                let value = Reflect.get(target, property, target);
                return typeof value === "function" ? value.bind(target) : value;
            },
        });
        return handler.call(context, code, id, options);
    };
}
