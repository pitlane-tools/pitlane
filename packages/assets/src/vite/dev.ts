import type { Plugin, ViteDevServer } from "vite";

import { isCSSRequest, normalizePath } from "vite";

import type { ModuleEdges } from "./dev-graph.ts";
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
    /** Server environments invalidated while their snapshot was being built. */
    let stale = new Set<string>();
    /** Environment name → module id → how many hard invalidations the module has had. */
    let invalidations = new Map<string, Map<string, number>>();

    /**
     * Invalidates a server environment's manifest and, through Vite, every
     * module importing it. A manifest being built is marked instead, and
     * `load` builds it again, since Vite would cache the code `load` returns.
     */
    function invalidate(name: string, timestamp?: number) {
        if (building.has(name)) return void stale.add(name);
        let environment = server?.environments[name];
        let manifest = environment?.moduleGraph.getModuleById(MANIFEST_ID);
        if (manifest)
            environment!.moduleGraph.invalidateModule(manifest, new Set(), timestamp, true);
    }

    /** The modules of `environment` a server environment's snapshot was computed from. */
    function tracked(environment: string, serverName: string): Set<string> | undefined {
        let snapshot = snapshots.get(serverName);
        if (environment === serverName) return snapshot?.server;
        if (environment === "client") return snapshot?.client;
    }

    /** Invalidates every snapshot computed from module `id` of `environment`. */
    function invalidateSnapshotsWith(environment: string, id: string, timestamp?: number) {
        for (let serverName of snapshots.keys()) {
            if (tracked(environment, serverName)?.has(id)) invalidate(serverName, timestamp);
        }
    }

    function sameEdges(previous: ModuleEdges, next: ModuleEdges): boolean {
        return (
            previous.static.length === next.static.length &&
            previous.dynamic.length === next.dynamic.length &&
            previous.static.every((edge, index) => edge === next.static[index]) &&
            previous.dynamic.every((edge, index) => edge === next.dynamic[index])
        );
    }

    /**
     * Records the edges a transform of module `id` found and returns whether it
     * kept them. Two transforms of the same code find the same edges, so
     * differing ones mean one transform read code an invalidation superseded
     * before this plugin saw it, and the order they finish in does not say
     * which. Dropping the record makes the next snapshot transform the module
     * again.
     */
    function recordEdges(environment: string, id: string, next: ModuleEdges): boolean {
        let edges = environmentEdges(graph, environment);
        let previous = edges.get(id);
        if (previous && !sameEdges(previous, next)) {
            edges.delete(id);
            invalidateSnapshotsWith(environment, id);
            return false;
        }
        edges.set(id, next);
        return true;
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
                    let { name, moduleGraph } = environment;
                    let edges = environmentEdges(graph, name);
                    let invalidated = new Map<string, number>();
                    invalidations.set(name, invalidated);
                    // A hard invalidation says the module's own transform is
                    // stale, so the edges that transform recorded are too. A
                    // soft one, which a changed import propagates to its
                    // static importers, only renames the URLs they import.
                    // Vite reports file changes this way, and so does a plugin
                    // invalidating a module it generates, which `hotUpdate`
                    // never hears about.
                    let invalidateModule = moduleGraph.invalidateModule;
                    moduleGraph.invalidateModule = (
                        mod,
                        seen,
                        timestamp,
                        isHmr,
                        softInvalidate,
                    ) => {
                        if (
                            !softInvalidate &&
                            mod.id &&
                            mod.id !== MANIFEST_ID &&
                            !isCSSRequest(mod.id)
                        ) {
                            edges.delete(mod.id);
                            invalidated.set(mod.id, (invalidated.get(mod.id) ?? 0) + 1);
                            invalidateSnapshotsWith(name, mod.id, timestamp);
                        }
                        invalidateModule.call(
                            moduleGraph,
                            mod,
                            seen,
                            timestamp,
                            isHmr,
                            softInvalidate,
                        );
                    };
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
                // An invalidation that lands mid-build marks the environment
                // stale; one more pass reads what changed. A transform that
                // invalidated modules on every run would otherwise never settle.
                let snapshot: DevSnapshot;
                let passes = 0;
                do {
                    stale.delete(name);
                    snapshot = await createDevSnapshot(server!, state, graph, name);
                } while (stale.has(name) && ++passes < 3);
                snapshots.set(name, snapshot);
                return `export default JSON.parse(${JSON.stringify(JSON.stringify(snapshot.manifest))});\n`;
            } finally {
                building.delete(name);
                stale.delete(name);
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
                // A hard invalidation after this point means the code being
                // transformed is superseded, and so is everything found in it.
                let invalidated = invalidations.get(name);
                let invalidationsAtStart = invalidated?.get(id);
                let superseded = () => invalidated?.get(id) !== invalidationsAtStart;
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
                if (superseded()) return;
                if (!recordEdges(name, id, { static: staticEdges, dynamic: dynamicEdges })) return;

                if (!state.serverEnvironments.includes(name)) return;
                let modules = graph.resolverUsage.get(name);
                if (!modules) graph.resolverUsage.set(name, (modules = new Map()));
                let usage = scanResolverUsage(code, id);
                if (!usage) return void modules.delete(id);
                let linked = await linkResolverUsage(usage, specifier =>
                    this.resolve(specifier, id),
                );
                if (!superseded()) modules.set(id, linked);
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
                for (let serverName of snapshots.keys()) {
                    let set = tracked(name, serverName);
                    if (set && (set.has(path) || ids.some(id => set.has(id))))
                        invalidate(serverName, timestamp);
                }
            },
        },
    };
}
