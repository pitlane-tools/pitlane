import type { Program } from "oxc-parser";
import type { RouteMap } from "remix/routes";
import type { ResolvedConfig, ViteDevServer } from "vite";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseSync } from "oxc-parser";
import { createServer } from "vite";

/**
 * Loads the app's route map from source.
 *
 * Prerendering normally reads the `routes` export straight off the built
 * server bundle, which is the artifact production runs. A bundle built for
 * another runtime cannot be imported here, so this takes the long way round:
 * find the module the server entry gets `routes` from, and load that one. A
 * route map is a plain object of patterns, so it runs anywhere — the platform
 * imports that make the bundle unloadable live in the entry, not in it.
 *
 * @param ssrConfig The resolved config of the `ssr` environment.
 * @param serverEntry The plugin's `serverEntry` option.
 * @returns The route map, or `undefined` when the entry does not export one.
 */
export async function loadRouteMap(
    ssrConfig: ResolvedConfig,
    serverEntry: string,
): Promise<RouteMap | undefined> {
    // Deliberately not the project's own config: that is the config whose
    // platform plugin makes the module unloadable in the first place. Resolve
    // settings carry over so path aliases still land.
    let server = await createServer({
        configFile: false,
        root: ssrConfig.root,
        logLevel: "silent",
        server: { middlewareMode: true, watch: null },
        optimizeDeps: { noDiscovery: true },
        resolve: {
            alias: ssrConfig.resolve.alias,
            extensions: ssrConfig.resolve.extensions,
        },
    });

    try {
        let entryId = await resolve(server, path.resolve(ssrConfig.root, serverEntry));
        if (!entryId) return undefined;

        let specifier = routeMapSpecifier(await fs.readFile(entryId, "utf8"), entryId);
        if (!specifier) return undefined;

        let routesId = await resolve(server, specifier, entryId);
        if (!routesId) return undefined;

        let module = (await server.ssrLoadModule(routesId)) as { routes?: RouteMap };
        return module.routes;
    } finally {
        await server.close();
    }
}

async function resolve(
    server: ViteDevServer,
    source: string,
    importer?: string,
): Promise<string | undefined> {
    let resolved = await server.environments.ssr.pluginContainer.resolveId(source, importer);
    return resolved?.id;
}

/**
 * The module a server entry gets its `routes` binding from, in either of the
 * two shapes that reads naturally:
 *
 * ```ts
 * export { routes } from "./routes.ts";
 * // or
 * import { routes } from "./routes.ts";
 * export { routes };
 * ```
 *
 * A route map declared inline in the entry has no other module to point at,
 * and yields `undefined`.
 */
function routeMapSpecifier(code: string, filename: string): string | undefined {
    let program: Program = parseSync(filename, code).program;
    let local: string | undefined;

    for (let node of program.body) {
        if (node.type !== "ExportNamedDeclaration") continue;
        for (let specifier of node.specifiers) {
            if (moduleExportName(specifier.exported) !== "routes") continue;
            if (node.source) return node.source.value;
            local = moduleExportName(specifier.local);
        }
    }

    if (!local) return undefined;

    for (let node of program.body) {
        if (node.type !== "ImportDeclaration") continue;
        for (let specifier of node.specifiers ?? []) {
            if (specifier.local.name === local) return node.source.value;
        }
    }

    return undefined;
}

/** An exported or imported name, which the grammar allows to be a string. */
function moduleExportName(node: { type: string; name?: string; value?: string }): string {
    return node.type === "Identifier" ? (node.name ?? "") : (node.value ?? "");
}
