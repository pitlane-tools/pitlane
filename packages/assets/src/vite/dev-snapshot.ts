import type { DevEnvironment, ViteDevServer } from "vite";

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { isCSSRequest } from "vite";

import type { AssetEnvironment, DevAssetsManifest } from "../types.ts";
import type { ModuleEdges } from "./dev-graph.ts";
import type { ResolverUsage } from "./resolver-usage.ts";
import type { AssetPluginState } from "./state.ts";

import { servedPath, staticStylesheets, walkGraph } from "./dev-graph.ts";
import { fileModule, inputPath, sourceKey } from "./entries.ts";
import { literalInputs } from "./resolver-usage.ts";

/** What the dev plugin learned from transforms, per environment. */
export interface DevGraph {
    /** Server environment name → entries requested by its module runner. */
    roots: Map<string, Set<string>>;
    /** Environment name → module id → resolved edges. */
    edges: Map<string, Map<string, ModuleEdges>>;
    /** Server environment name → module id → its literal resolver calls and resolver exports. */
    resolverUsage: Map<string, Map<string, ResolverUsage>>;
}

/** One server environment's development manifest and the modules it was computed from. */
export interface DevSnapshot {
    manifest: DevAssetsManifest;
    server: Set<string>;
    client: Set<string>;
}

export function environmentEdges(graph: DevGraph, name: string): Map<string, ModuleEdges> {
    let edges = graph.edges.get(name);
    if (!edges) graph.edges.set(name, (edges = new Map()));
    return edges;
}

/**
 * Whether a module id is a source file with a key of its own. Vite's `?v=`
 * version hash on a package module does not change which file it is; any
 * other query, such as a single-file component's style block, names a part
 * of its file that the file's own key already covers.
 */
function sourceModule(id: string): boolean {
    return fileModule(id) && !id.replace(/\?v=[\w-]+$/, "").includes("?");
}

/** The resolved, non-HTML build inputs an environment declares. */
async function configuredInputs(environment: DevEnvironment): Promise<string[]> {
    let { build, root } = environment.config;
    let input = build.rolldownOptions.input;
    let inputs =
        typeof input === "string"
            ? [input]
            : Array.isArray(input)
              ? input
              : Object.values(input ?? {});
    let ids: string[] = [];
    for (let entry of inputs) {
        if (entry.endsWith(".html")) continue;
        let file = resolve(root, entry);
        let resolved = await environment.pluginContainer.resolveId(existsSync(file) ? file : entry);
        if (!resolved)
            throw new Error(
                `[assets] Could not resolve the "${environment.name}" environment's input "${entry}".`,
            );
        ids.push(resolved.id);
    }
    return ids;
}

export async function createDevSnapshot(
    server: ViteDevServer,
    state: AssetPluginState,
    graph: DevGraph,
    name: string,
): Promise<DevSnapshot> {
    let config = state.config!;
    let { root } = config;
    let base = config.base.replace(/\/$/, "");
    let serverEnvironment = server.environments[name]!;
    let clientEnvironment = server.environments.client!;
    let serverEdges = environmentEdges(graph, name);
    let serverIds = await walkGraph(
        serverEnvironment,
        [...(await configuredInputs(serverEnvironment)), ...(graph.roots.get(name) ?? [])],
        serverEdges,
    );

    // Worker integrations can load the manifest before Vite starts the client optimizer.
    await clientEnvironment.depsOptimizer?.init();

    let entryIds = new Set([
        ...state.inputs.keys(),
        ...(await configuredInputs(clientEnvironment)),
    ]);
    let usage = graph.resolverUsage.get(name) ?? new Map<string, ResolverUsage>();
    let registrations = state.registrations.get(name);
    for (let id of serverIds) {
        for (let input of literalInputs(usage, id)) entryIds.add(inputPath(root, input.key));
        for (let entry of registrations?.get(id) ?? []) entryIds.add(entry);
    }

    let entries: Record<string, string> = Object.create(null);
    let assets: Record<string, string> = Object.create(null);
    let scripts: string[] = [];
    for (let id of entryIds) {
        let url = base + servedPath(root, id);
        if (isCSSRequest(id) || config.assetsInclude(id.split("?")[0]!)) {
            assets[sourceKey(root, id)] = url;
        } else {
            entries[sourceKey(root, id)] = url;
            scripts.push(id);
        }
    }
    let clientIds = await walkGraph(clientEnvironment, scripts, environmentEdges(graph, "client"));

    let serverModules: AssetEnvironment["modules"] = Object.create(null);
    for (let id of serverIds) {
        if (!sourceModule(id)) continue;
        serverModules[sourceKey(root, id)] = {
            preloads: [],
            stylesheets: staticStylesheets(serverEdges, id).map(
                stylesheet => base + servedPath(root, stylesheet),
            ),
        };
    }
    let clientModules: AssetEnvironment["modules"] = Object.create(null);
    for (let id of clientIds) {
        if (sourceModule(id))
            clientModules[sourceKey(root, id)] = { preloads: [], stylesheets: [] };
    }

    return {
        manifest: {
            mode: "dev",
            environments: {
                client: { role: "client", modules: clientModules },
                [name]: { role: "server", modules: serverModules },
            },
            entries,
            assets,
            serverEnvironment: name,
        },
        server: serverIds,
        client: clientIds,
    };
}
