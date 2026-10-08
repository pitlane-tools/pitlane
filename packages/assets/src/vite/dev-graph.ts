import type { DevEnvironment, Rollup } from "vite";

import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { isCSSRequest, parseSync } from "vite";

import { fileModule, sourceKey } from "./entries.ts";
import { MANIFEST_ID } from "./state.ts";

/** One module's resolved imports, with lazy `import()` edges kept apart from static ones. */
export interface ModuleEdges {
    static: string[];
    dynamic: string[];
}

/** CSS requests that import a string or URL rather than apply a stylesheet. */
const NON_STYLESHEET_QUERY = /[?&](?:inline|url|raw)\b/;

/**
 * The import specifiers of transformed JavaScript. Only literal `import()`
 * arguments count as dynamic edges; a computed argument names no module.
 */
export function importSpecifiers(code: string): { static: string[]; dynamic: string[] } {
    let { module } = parseSync("module.js", code, { sourceType: "module" });
    let staticSpecifiers = new Set(module.staticImports.map(entry => entry.moduleRequest.value));
    for (let entry of module.staticExports) {
        for (let item of entry.entries)
            if (item.moduleRequest) staticSpecifiers.add(item.moduleRequest.value);
    }
    let dynamicSpecifiers = new Set<string>();
    for (let entry of module.dynamicImports) {
        let literal = /^(["'`])([^"'`$]*)\1$/.exec(
            code.slice(entry.moduleRequest.start, entry.moduleRequest.end).trim(),
        );
        if (literal) dynamicSpecifiers.add(literal[2]!);
    }
    return { static: [...staticSpecifiers], dynamic: [...dynamicSpecifiers] };
}

/**
 * A module's edges after `vite:import-analysis` ran: it resolved every
 * import, rewrote each specifier to the URL it serves the module at, and
 * recorded the modules it reached on the graph node. Reading those back
 * costs a parse; resolving the specifiers again would cost what Vite just
 * paid. The node does not say which of them a resolver marked external —
 * it records a node for an external file path too — so the caller passes
 * the ids it saw resolve that way. Only an import the node does not list,
 * one import analysis left alone, is resolved here.
 */
export async function moduleEdges(
    environment: DevEnvironment,
    id: string,
    code: string,
    external: ReadonlySet<string>,
    resolve: (specifier: string) => Promise<Rollup.ResolvedId | null>,
): Promise<ModuleEdges> {
    let known = new Map<string, string>();
    for (let node of environment.moduleGraph.getModuleById(id)?.importedModules ?? []) {
        if (node.id) known.set(importedUrl(node.url, ""), node.id);
    }
    // Import analysis prefixes `base` for the browser only.
    let base =
        environment.config.consumer === "client" ? environment.config.base.replace(/\/$/, "") : "";
    let ids = async (urls: string[]) => {
        let resolved = await Promise.all(
            urls.map(async url => {
                // The HMR runtime import analysis injects is Vite's, not the app's.
                if (url.startsWith("/@vite/")) return;

                let imported = known.get(importedUrl(url, base));
                if (imported) return external.has(imported) ? undefined : imported;
                let result = await resolve(url);
                return result && !result.external ? result.id : undefined;
            }),
        );
        return [...new Set(resolved.flatMap(id => (id ? [id] : [])))];
    };
    let specifiers = importSpecifiers(code);
    let [staticEdges, dynamicEdges] = await Promise.all([
        ids(specifiers.static),
        ids(specifiers.dynamic),
    ]);
    return { static: staticEdges, dynamic: dynamicEdges };
}

/**
 * The module-graph URL behind a rewritten import: without `base`, the
 * `?import` marker import analysis adds to an asset import, and the `?t=`
 * timestamp of a hot-updated module, with `/@id/` unwrapped as Vite does.
 * A virtual module's node keeps its URL with or without the leading null
 * byte depending on who created the node, so the key drops it on both sides.
 */
function importedUrl(url: string, base: string): string {
    if (base && url.startsWith(`${base}/`)) url = url.slice(base.length);
    url = url.replace(/[?&]import(?=$|&)/, "").replace(/[?&]t=\d+(?=$|&)/, "");
    url = url.replace(/\?&/, "?").replace(/\?$/, "");
    if (url.startsWith("/@id/")) url = url.slice("/@id/".length).replace("__x00__", "\0");
    return url.replace(/^\0/, "");
}

/** The path Vite's dev server serves a resolved module id at, before `base`. */
export function servedPath(root: string, id: string): string {
    if (id.startsWith("\0")) return `/@id/__x00__${id.slice(1)}`;
    let query = id.indexOf("?");
    let file = query === -1 ? id : id.slice(0, query);
    let search = query === -1 ? "" : id.slice(query);
    if (!isAbsolute(file)) return `/@id/${id}`;
    if (file.startsWith(`${root}/`)) return file.slice(root.length) + search;
    return `/@fs/${file.replace(/^\//, "")}${search}`;
}

/**
 * Whether discovery transforms a module. A server environment reads a package
 * from `node_modules` only when Vite transforms rather than externalizes it.
 * The client follows packages Vite serves as source, but not a prebundled
 * dependency: the optimizer's cache file is not a source module, and loading
 * it would wait for the optimizer.
 */
function followed(environment: DevEnvironment, id: string): boolean {
    if (id === MANIFEST_ID || environment.depsOptimizer?.isOptimizedDepFile(id)) return false;
    let pkg = /.*\/node_modules\/((?:@[^/]+\/)?[^/?]+)/.exec(id)?.[1];
    if (pkg === undefined || environment.config.consumer === "client") return true;
    let { noExternal } = environment.config.resolve;
    if (noExternal === true) return true;
    let patterns =
        noExternal === undefined ? [] : Array.isArray(noExternal) ? noExternal : [noExternal];
    return patterns.some(pattern =>
        typeof pattern === "string" ? pattern === pkg : pattern.test(pkg),
    );
}

/**
 * A module is analyzed once. Its edge record was written by the transform
 * hook, whether the runner or discovery ran that transform, and stays
 * current until `hotUpdate` reports the module's file changed, which drops
 * the record. Keying this on `transformResult` instead would re-transform
 * every module the runner has not executed on each rebuild.
 *
 * Client discovery goes through `transformRequest`, so it shares Vite's
 * in-flight and cached transforms with the import analysis that warms a
 * browser module's dependencies, and the browser later reads the cache.
 * Server discovery must not populate `transformResult`: the module runner
 * asks whether a module it already evaluated is still current by that
 * field, so a transform cached between a file change and the runner's next
 * import would keep its stale instance alive.
 */
async function analyze(
    environment: DevEnvironment,
    id: string,
    edges: Map<string, ModuleEdges>,
): Promise<void> {
    if (edges.has(id)) return;
    let { root } = environment.config;
    try {
        let url = servedPath(root, id);
        if (environment.config.consumer === "client") {
            // Vite's middleware and `fetchModule` unwrap `/@id/` before calling
            // `transformRequest`; a virtual or bare id is its own URL there.
            await environment.transformRequest(url.startsWith("/@id/") ? id : url);
            return;
        }
        await environment.moduleGraph.ensureEntryFromUrl(url);
        let loaded = await environment.pluginContainer.load(id);
        let code = loaded == null ? null : typeof loaded === "string" ? loaded : loaded.code;
        if (code == null) {
            if (!fileModule(id)) throw new Error("No plugin loaded the module.");
            code = await readFile(id.split("?")[0]!, "utf8");
        }
        await environment.pluginContainer.transform(code, id);
    } catch (error) {
        let name = fileModule(id) ? sourceKey(root, id) : id;
        throw new Error(
            `[assets] Could not analyze "${name}" for the "${environment.name}" development asset manifest: ${(error as Error).message}`,
            { cause: error },
        );
    }
}

/**
 * Every module reachable from `roots` through static and dynamic edges,
 * transforming each one the graph has not analyzed yet. Stylesheets are
 * leaves: their own `@import`s are inlined by Vite's CSS pipeline. Passing
 * the result of an earlier walk extends it without revisiting its modules.
 */
export async function walkGraph(
    environment: DevEnvironment,
    roots: Iterable<string>,
    edges: Map<string, ModuleEdges>,
    visited = new Set<string>(),
): Promise<Set<string>> {
    let frontier = [...roots];
    while (frontier.length > 0) {
        let next: string[] = [];
        await Promise.all(
            frontier.map(async id => {
                // A stylesheet is a leaf the module importing it observed, even from a package not followed.
                if (visited.has(id) || !(isCSSRequest(id) || followed(environment, id))) return;
                visited.add(id);
                if (isCSSRequest(id)) return;
                await analyze(environment, id, edges);
                let record = edges.get(id);
                if (record) next.push(...record.static, ...record.dynamic);
            }),
        );
        frontier = next;
    }
    return visited;
}

/**
 * The stylesheet ids a module requires through static imports, in execution
 * order: each dependency's stylesheets before its importer's later imports.
 */
export function staticStylesheets(edges: Map<string, ModuleEdges>, start: string): string[] {
    let seen = new Set<string>();
    let stylesheets: string[] = [];
    let visit = (id: string) => {
        if (seen.has(id)) return;
        seen.add(id);
        if (isCSSRequest(id)) {
            if (!NON_STYLESHEET_QUERY.test(id)) stylesheets.push(id);
            return;
        }
        for (let dependency of edges.get(id)?.static ?? []) visit(dependency);
    };
    visit(start);
    return stylesheets;
}
