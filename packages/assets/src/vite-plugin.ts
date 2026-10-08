import type { Plugin, PluginOption } from "vite";

import type { AssetPluginState } from "./vite/state.ts";

import { browserBoundary } from "./vite/boundary.ts";
import { assetBuild } from "./vite/build.ts";
import { assetStyles } from "./vite/dev-css.ts";
import { assetDevelopment } from "./vite/dev.ts";
import { inputPath, sourceKey } from "./vite/entries.ts";
import { linkResolverUsage, scanResolverUsage } from "./vite/resolver-usage.ts";
import { MANIFEST_EXTERNAL, MANIFEST_ID, unservedEnvironmentError } from "./vite/state.ts";

export { ASSETS_MANIFEST_FILE } from "./vite/state.ts";

export interface AssetsPluginOptions {
    /** Extra source keys to make available as client entries or assets. */
    include?: string[];
    /** Server environments whose module graphs provide metadata. Defaults to `["ssr"]`. */
    serverEnvironments?: string[];
    /** Override Vite's native setting. With neither setting present, maps are disabled. */
    chunkImportMap?: boolean;
    /**
     * Files and globs, relative to the Vite root, that may reach the browser.
     * Setting it turns on the browser boundary: a build that would publish any
     * other file fails, and `vite dev` refuses to serve one. Read as
     * `remix/assets` reads it; a directory path matches every file below it.
     */
    allowFiles?: string[];
    /**
     * Packages that may reach the browser, with their `dependencies` and
     * installed `optionalDependencies`. Peer dependencies are not included.
     * Requires `allowFiles`.
     */
    allowPackages?: string[];
    /** Files and globs refused even when `allowFiles` or `allowPackages` allows them. Requires `allowFiles`. */
    denyFiles?: string[];
}

/** Browser entries declared by one server module's development transform. */
export interface AssetEntryRegistration {
    /** The server environment that transformed the owner. */
    environment: string;
    /** The resolved server module ID declaring these entries. */
    owner: string;
    /** Resolved browser module IDs; an empty list removes the owner's declarations. */
    entries: string[];
}

/** Available on the resolved plugin named `pitlane-assets`. */
export interface AssetsPluginApi {
    /** Replace an owner's declarations; an empty list removes them. Builds use `emitFile` instead. */
    setBrowserEntries(registration: AssetEntryRegistration): void;
}

export function assets(options: AssetsPluginOptions = {}): PluginOption {
    let { allowFiles, allowPackages, denyFiles } = options;
    if (!allowFiles && (allowPackages || denyFiles)) {
        throw new Error(
            "[assets] allowPackages and denyFiles refine allowFiles. Set allowFiles to turn on the browser boundary.",
        );
    }
    let state: AssetPluginState = {
        serverEnvironments: options.serverEnvironments ?? ["ssr"],
        inputs: new Map(),
        resolverUsage: new Map(),
        registrations: new Map(),
        assetReferences: new Map(),
        scriptReferences: new Map(),
        outputs: new Map(),
        mapsEnabled: false,
    };
    let api: AssetsPluginApi = {
        setBrowserEntries({ environment, owner, entries }) {
            if (!state.serverEnvironments.includes(environment)) {
                throw new Error(
                    `[assets] Cannot register browser entries from "${environment}": it is not in serverEnvironments.`,
                );
            }
            let owners = state.registrations.get(environment);
            let previous = owners?.get(owner);
            if (
                (!previous && entries.length === 0) ||
                (previous?.length === entries.length &&
                    entries.every((id, index) => id === previous[index]))
            )
                return;
            if (entries.length === 0) {
                owners!.delete(owner);
                if (owners!.size === 0) state.registrations.delete(environment);
            } else {
                if (!owners) state.registrations.set(environment, (owners = new Map()));
                owners.set(owner, entries.slice());
            }
            state.onRegistrationChange?.(environment, owner);
        },
    };
    let integration: Plugin = {
        name: "pitlane-assets",
        api,
        enforce: "post",
        sharedDuringBuild: true,
        config(config) {
            state.mapsEnabled =
                options.chunkImportMap ??
                config.environments?.client?.build?.chunkImportMap ??
                config.build?.chunkImportMap ??
                false;
            if (state.mapsEnabled && config.experimental?.renderBuiltUrl) {
                throw new Error(
                    "[assets] chunkImportMap: true cannot be combined with experimental.renderBuiltUrl.",
                );
            }
            return {
                builder: {},
                build: { assetsInlineLimit: 0 },
                optimizeDeps: { exclude: ["@pitlane/assets/manifest", "pitlane/assets/manifest"] },
                environments: { client: { build: { chunkImportMap: state.mapsEnabled } } },
            };
        },
        configResolved(config) {
            state.config = config;
            for (let key of options.include ?? []) {
                let id = inputPath(config.root, key);
                state.inputs.set(id, { key: sourceKey(config.root, id), kind: "asset" });
            }
        },
        configEnvironment(name) {
            if (!state.serverEnvironments.includes(name)) return;
            return {
                resolve: { noExternal: [/^@pitlane\/assets(?:\/|$)/, /^pitlane(?:\/|$)/] },
                optimizeDeps: { exclude: ["@pitlane/assets/manifest", "pitlane/assets/manifest"] },
                build: { chunkImportMap: false },
            };
        },
        resolveId: {
            order: "pre",
            handler(id) {
                if (id !== "@pitlane/assets/manifest" && id !== "pitlane/assets/manifest") return;
                if (this.environment.mode === "build" && this.environment.name === "client") {
                    throw new Error(
                        "[assets] The asset manifest is server-only; keep resolver lookups out of browser modules.",
                    );
                }
                if (this.environment.mode !== "build") return MANIFEST_ID;
                if (!state.serverEnvironments.includes(this.environment.name)) {
                    throw unservedEnvironmentError(this.environment.name, state.serverEnvironments);
                }
                return { id: MANIFEST_EXTERNAL, external: true };
            },
        },
        async transform(code, id) {
            let { mode, name } = this.environment;
            if (mode !== "build" || !state.serverEnvironments.includes(name)) return;
            let modules = state.resolverUsage.get(name);
            if (!modules) state.resolverUsage.set(name, (modules = new Map()));
            let usage = scanResolverUsage(code, id);
            if (!usage) return void modules.delete(id);
            modules.set(
                id,
                await linkResolverUsage(usage, specifier => this.resolve(specifier, id)),
            );
        },
    };
    return [
        integration,
        assetBuild(state),
        assetDevelopment(state),
        assetStyles(),
        allowFiles &&
            browserBoundary({ allowFiles, allowPackages, denyFiles }, state.serverEnvironments),
    ];
}
