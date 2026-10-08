import type { Environment, Plugin, ResolvedConfig } from "vite";

/**
 * Vite plugins that fold other files into a module without adding them to
 * any module graph, and report them only as watch files: the CSS plugin reads
 * a stylesheet's `@import`s, preprocessor partials, and `url()` targets, and
 * the worker plugins bundle a worker's modules.
 */
export type FoldingPlugin = "vite:css" | "vite:worker" | "vite:worker-import-meta-url";

type FoldedFileObserver = (
    environment: Environment,
    plugin: FoldingPlugin,
    module: string,
    file: string,
) => void;

interface WatchingContext {
    environment: Environment;
    addWatchFile(file: string): void;
}

/** `context`, with `addWatchFile` reporting each file to `observe` before Vite records it. */
function watching<T extends WatchingContext>(context: T, observe: (file: string) => void): T {
    return new Proxy(context, {
        get(target, property) {
            if (property === "addWatchFile") {
                return (file: string) => {
                    observe(file);
                    target.addWatchFile(file);
                };
            }
            let value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
        },
    });
}

function unsupported(name: FoldingPlugin): Error {
    return new Error(
        `[assets] This Vite version does not expose the ${name} hook the browser boundary reads. Use a supported Vite version.`,
    );
}

/** Calls `observe` with every file the folding plugins report, by wrapping their hooks' contexts. */
export function observeFoldedFiles(config: ResolvedConfig, observe: FoldedFileObserver): void {
    let plugin = (name: FoldingPlugin): Plugin | undefined =>
        config.plugins.find(candidate => candidate.name === name);
    for (let name of ["vite:css", "vite:worker-import-meta-url"] as const) {
        let hook = plugin(name)?.transform;
        if (typeof hook !== "object") throw unsupported(name);
        let handler = hook.handler;
        hook.handler = function (code, id, options) {
            let context = watching(this, file => observe(this.environment, name, id, file));
            return handler.call(context, code, id, options);
        };
    }
    let hook = plugin("vite:worker")?.load;
    if (typeof hook !== "object") throw unsupported("vite:worker");
    let handler = hook.handler;
    hook.handler = function (id, options) {
        let context = watching(this, file => observe(this.environment, "vite:worker", id, file));
        return handler.call(context, id, options);
    };
}
