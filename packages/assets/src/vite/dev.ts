import type { Plugin, ViteDevServer } from "vite";

import { isCSSRequest, normalizePath } from "vite";

import type { DevGraph, DevSnapshot } from "./dev-snapshot.ts";
import type { AssetPluginState } from "./state.ts";

import { assetsSpecifier } from "../specifier.ts";
import { importSpecifiers } from "./dev-graph.ts";
import { createDevSnapshot, environmentEdges } from "./dev-snapshot.ts";
import { linkResolverUsage, scanResolverUsage } from "./resolver-usage.ts";
import { MANIFEST_ID, unservedEnvironmentError } from "./state.ts";

/**
 * Serves `@pitlane/assets/manifest` during `vite dev` as a data snapshot of
 * each server environment's module graph, and invalidates it when a change
 * could alter the stylesheets, routes, or browser entries it records.
 */
export function assetDevelopment(state: AssetPluginState): Plugin {
    let server: ViteDevServer | undefined;
    let graph: DevGraph = { roots: new Map(), edges: new Map(), resolverUsage: new Map() };
    let snapshots = new Map<string, DevSnapshot>();
    let building = new Set<string>();

    /** Invalidates a server environment's manifest and, through Vite, every module importing it. */
    function invalidate(name: string, timestamp?: number) {
        let environment = server?.environments[name];
        let manifest = environment?.moduleGraph.getModuleById(MANIFEST_ID);
        if (manifest)
            environment!.moduleGraph.invalidateModule(manifest, new Set(), timestamp, true);
    }

    return {
        name: "pitlane-assets-dev",
        apply: "serve",
        enforce: "post",
        configureServer: {
            // Platform plugins such as Cloudflare's import server code from
            // their own configureServer hook, which loads the manifest.
            order: "pre",
            handler(devServer) {
                server = devServer;
                for (let environment of Object.values(devServer.environments)) {
                    let { name } = environment;
                    if (!state.serverEnvironments.includes(name)) continue;
                    let roots = new Set<string>();
                    graph.roots.set(name, roots);
                    // Runner entries can differ from build inputs; manifest importers are not roots.
                    let fetchModule = environment.fetchModule;
                    environment.fetchModule = async (id, importer, options) => {
                        let fetched = await fetchModule.call(environment, id, importer, options);
                        if (!importer && "id" in fetched && fetched.id !== MANIFEST_ID) {
                            roots.add(fetched.id);
                            let snapshot = snapshots.get(name);
                            if (snapshot && !snapshot.server.has(fetched.id)) invalidate(name);
                        }
                        return fetched;
                    };
                }
                state.onRegistrationChange = (environment, owner) => {
                    // A snapshot being built reads registrations after its transforms.
                    if (building.has(environment)) return;
                    if (snapshots.get(environment)?.server.has(owner)) invalidate(environment);
                };
            },
        },
        async load(id) {
            if (id !== MANIFEST_ID) return;
            let { name, config } = this.environment;
            if (config.consumer === "client") {
                let message =
                    `[assets] ${assetsSpecifier("manifest")} describes the server's module graph and cannot run in the browser. ` +
                    "Resolve asset URLs in server code and pass them to the page.";
                return `throw new Error(${JSON.stringify(message)});\nexport default undefined;\n`;
            }
            if (!state.serverEnvironments.includes(name)) {
                throw unservedEnvironmentError(name, state.serverEnvironments);
            }
            building.add(name);
            try {
                let snapshot = await createDevSnapshot(server!, state, graph, name);
                snapshots.set(name, snapshot);
                return `export default JSON.parse(${JSON.stringify(JSON.stringify(snapshot.manifest))});\n`;
            } finally {
                building.delete(name);
            }
        },
        transform: {
            // A normal-order hook of this enforce: "post" plugin runs after other
            // plugins' transforms but before vite:import-analysis, which rewrites
            // specifiers into served URLs such as `logo.svg?import` or `?t=`.
            // Edges must name the modules' source ids, not those request URLs.
            async handler(code, id) {
                if (id === MANIFEST_ID || isCSSRequest(id)) return;
                let name = this.environment.name;
                let specifiers = importSpecifiers(code);
                let resolveAll = async (list: string[]) => {
                    let resolved = await Promise.all(
                        list.map(specifier => this.resolve(specifier, id)),
                    );
                    return [
                        ...new Set(
                            resolved.flatMap(result =>
                                result && !result.external ? [result.id] : [],
                            ),
                        ),
                    ];
                };
                let [staticEdges, dynamicEdges] = await Promise.all([
                    resolveAll(specifiers.static),
                    resolveAll(specifiers.dynamic),
                ]);
                environmentEdges(graph, name).set(id, {
                    static: staticEdges,
                    dynamic: dynamicEdges,
                });

                if (!state.serverEnvironments.includes(name)) return;
                let modules = graph.resolverUsage.get(name);
                if (!modules) graph.resolverUsage.set(name, (modules = new Map()));
                let usage = scanResolverUsage(code, id);
                if (!usage) return void modules.delete(id);
                modules.set(
                    id,
                    await linkResolverUsage(usage, specifier => this.resolve(specifier, id)),
                );
            },
        },
        hotUpdate: {
            // After vite:import-glob adds the glob importers of a created or deleted file.
            order: "post",
            handler({ type, file, modules, timestamp }) {
                // Editing a stylesheet's rules changes no graph; Vite updates it in place.
                if (type === "update" && isCSSRequest(file)) return;
                let path = normalizePath(file);
                if (type === "delete") {
                    for (let roots of graph.roots.values()) {
                        for (let root of roots) if (root.split("?")[0] === path) roots.delete(root);
                    }
                    for (let owners of [
                        ...state.registrations.values(),
                        ...graph.resolverUsage.values(),
                    ]) {
                        for (let owner of owners.keys())
                            if (owner.split("?")[0] === path) owners.delete(owner);
                    }
                }
                let name = this.environment.name;
                let ids = modules.flatMap(module => (module.id ? [module.id] : []));
                // The changed file's modules, including glob importers Vite
                // added, are analyzed again on the next snapshot; everything
                // else keeps the edges its last transform recorded.
                let edges = environmentEdges(graph, name);
                for (let id of ids) edges.delete(id);
                for (let id of edges.keys()) if (id.split("?")[0] === path) edges.delete(id);
                for (let [serverName, snapshot] of snapshots) {
                    let tracked =
                        name === serverName
                            ? snapshot.server
                            : name === "client"
                              ? snapshot.client
                              : undefined;
                    if (tracked && (tracked.has(path) || ids.some(id => tracked.has(id))))
                        invalidate(serverName, timestamp);
                }
            },
        },
    };
}
