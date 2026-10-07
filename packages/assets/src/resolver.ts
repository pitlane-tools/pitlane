import type {
    AssetMetadata,
    AssetsManifest,
    BuildAssetsManifest,
    DevAssetsManifest,
    ImportMap,
    ScriptEntry,
} from "./types.ts";

import { normalizeSourceKey } from "./source-key.ts";
import { assetsSpecifier, quotedList } from "./specifier.ts";

/** Narrows {@link AssetResolver.getStylesheets} to one environment's graph. */
export interface StylesheetOptions {
    /** The environment name, such as `"client"` or `"ssr"`. */
    environment?: string;
}

/**
 * Resolves portable source keys, such as `app/entry.browser.ts` or
 * `file:app/counter.tsx#Counter`, to the URLs a build or development server
 * produced for them.
 *
 * Structurally compatible with the resolution methods of a `remix/assets`
 * asset server, so it can be passed to `render({ assets })`.
 */
export interface AssetResolver {
    /** A registered browser entry's URL, `modulepreload` URLs, and the client import map. */
    getScriptEntry(path: string): Promise<ScriptEntry>;
    /** The URL of a registered browser entry, stylesheet, or other asset. */
    getHref(path: string): Promise<string>;
    /** Scripts' chunks and static JavaScript dependencies, and explicitly requested stylesheets. */
    getPreloads(path: string | readonly string[]): Promise<string[]>;
    /** Stylesheets the modules need, from the client and current server graphs by default. */
    getStylesheets(
        path: string | readonly string[],
        options?: StylesheetOptions,
    ): Promise<string[]>;
    /** The complete client import map, after checking the keys belong to the client graph. */
    getImportMap(path: string | readonly string[]): Promise<ImportMap>;
}

type Method = keyof AssetResolver;

/**
 * Constructs the resolver for a manifest, usually the default export of
 * `@pitlane/assets/manifest`. Construct it once, in a module of the app's own.
 */
export function createAssetResolver(manifest: AssetsManifest): AssetResolver {
    if (manifest.mode === "unavailable") return unavailableResolver();
    return manifestResolver(manifest);
}

function unavailableResolver(): AssetResolver {
    let fail = (method: Method) => async (path: string | readonly string[]) => {
        throw new Error(
            `${call(method, path)} has no asset manifest to read: ${assetsSpecifier("manifest")} was not supplied by a build integration. ` +
                `Add assets() from ${assetsSpecifier("vite-plugin")} to your Vite config, or pass createAssetResolver() a manifest from createAssetManifest() in ${assetsSpecifier("build")}.`,
        );
    };
    return {
        getScriptEntry: fail("getScriptEntry"),
        getHref: fail("getHref"),
        getPreloads: fail("getPreloads"),
        getStylesheets: fail("getStylesheets"),
        getImportMap: fail("getImportMap"),
    };
}

function manifestResolver(manifest: BuildAssetsManifest | DevAssetsManifest): AssetResolver {
    let { environments, entries, assets } = manifest;
    let clientName =
        Object.keys(environments).find(name => environments[name]!.role === "client") ?? "client";
    let defaultStylesheetEnvironments = [
        ...new Set([clientName, manifest.serverEnvironment ?? clientName]),
    ];

    /** The client graph's metadata for a key, which a registered entry always has. */
    function clientMetadata(key: string): AssetMetadata | undefined {
        let metadata = own(environments[clientName]?.modules ?? {}, key);
        if (metadata) return metadata;
        let href = own(entries, key);
        return href === undefined ? undefined : { preloads: [href], stylesheets: [] };
    }

    function requireClientMetadata(method: Method, path: string, key: string): AssetMetadata {
        let metadata = clientMetadata(key);
        if (metadata) return metadata;
        throw new Error(
            `${call(method, path)} found no module "${key}" in the "${clientName}" environment's graph.`,
        );
    }

    function missingRegistration(method: Method, path: string, key: string, what: string): Error {
        let observedIn = Object.keys(environments).find(name =>
            Object.hasOwn(environments[name]!.modules, key),
        );
        let observation = observedIn
            ? `The module is in the "${observedIn}" graph but is not registered as a browser entry.`
            : "No environment's graph contains the module.";
        return new Error(
            `${call(method, path)} found no ${what} "${key}" in the "${clientName}" environment. ${observation} ` +
                `Pass the key to ${method}() as a string literal in server code, or list it in assets({ include }) from ${assetsSpecifier("vite-plugin")}.`,
        );
    }

    return {
        async getScriptEntry(path) {
            let key = sourceKey("getScriptEntry", path);
            let href = own(entries, key);
            if (href === undefined) {
                throw missingRegistration("getScriptEntry", path, key, "browser entry");
            }
            if (manifest.mode === "dev") return { href, preloads: [], importMap: { imports: {} } };
            return {
                href,
                preloads: [...clientMetadata(key)!.preloads],
                importMap: copyImportMap(manifest.importMap),
            };
        },

        async getHref(path) {
            let key = sourceKey("getHref", path);
            let href = own(entries, key) ?? own(assets, key);
            if (href === undefined) {
                throw missingRegistration("getHref", path, key, "browser entry or asset");
            }
            return href;
        },

        async getPreloads(paths) {
            let preloads = new Set<string>();
            for (let path of asList(paths)) {
                let key = sourceKey("getPreloads", path);
                let stylesheet = own(assets, key);
                if (stylesheet !== undefined && /\.css(?:[?#]|$)/.test(stylesheet)) {
                    preloads.add(stylesheet);
                    continue;
                }
                for (let href of requireClientMetadata("getPreloads", path, key).preloads) {
                    preloads.add(href);
                }
            }
            return manifest.mode === "dev" ? [] : [...preloads];
        },

        async getStylesheets(paths, options = {}) {
            let selected = options.environment
                ? [requireEnvironment(paths, options.environment)]
                : defaultStylesheetEnvironments;
            let stylesheets = new Set<string>();

            for (let path of asList(paths)) {
                let key = sourceKey("getStylesheets", path);
                let found = selected.flatMap(name => {
                    let graph = own(environments, name);
                    return (graph && own(graph.modules, key)) ?? [];
                });
                if (found.length === 0) {
                    throw new Error(
                        `${call("getStylesheets", path)} found no module "${key}" in the ${quotedList(selected, "disjunction")} environment's graph.`,
                    );
                }
                for (let href of found.flatMap(metadata => metadata.stylesheets)) {
                    stylesheets.add(href);
                }
            }
            return [...stylesheets];
        },

        async getImportMap(paths) {
            let list = asList(paths);
            for (let path of list) {
                requireClientMetadata("getImportMap", path, sourceKey("getImportMap", path));
            }
            if (list.length === 0 || manifest.mode === "dev") return { imports: {} };
            return copyImportMap(manifest.importMap);
        },
    };

    function requireEnvironment(paths: string | readonly string[], name: string): string {
        if (Object.hasOwn(environments, name)) return name;
        throw new Error(
            `${call("getStylesheets", paths)} names environment "${name}", which the manifest does not have. It has ${quotedList(Object.keys(environments), "conjunction")}.`,
        );
    }
}

/** Reads a source key's record without reaching `Object.prototype` members such as `constructor`. */
function own<Value>(record: Record<string, Value>, key: string): Value | undefined {
    return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** Callers merge their own mappings into the returned map; the manifest's stays intact. */
function copyImportMap(map: ImportMap): ImportMap {
    return structuredClone(map);
}

function sourceKey(method: Method, path: string): string {
    let key = normalizeSourceKey(path);
    if (key !== null) return key;
    throw new Error(
        `${call(method, path)} received an absolute file URL. Pass the source key relative to the project root instead, such as "file:app/counter.tsx" or "app/counter.tsx".`,
    );
}

function asList(paths: string | readonly string[]): readonly string[] {
    return typeof paths === "string" ? [paths] : paths;
}

/** How a message names the call that failed, such as `assets.getHref("app/logo.svg")`. */
function call(method: Method, path: string | readonly string[]): string {
    return `assets.${method}(${JSON.stringify(path)})`;
}
