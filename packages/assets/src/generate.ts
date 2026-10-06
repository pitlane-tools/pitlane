import type {
    AssetBuild,
    AssetBuildChunk,
    AssetBuildEnvironment,
    AssetEnvironment,
    AssetMetadata,
    BuildAssetsManifest,
} from "./types.ts";

import { normalizeSourceKey } from "./source-key.ts";
import { quotedList } from "./specifier.ts";

const CHUNK_LISTS = ["modules", "imports", "dynamicImports", "stylesheets"] as const;

/**
 * Converts a bundler's normalized output into the manifest
 * `createAssetResolver` reads.
 *
 * It walks each environment's static chunk graph to record, for every source
 * module, its `modulepreload` URLs (its chunk first, then dependencies
 * shallowest first) and stylesheets (a dependency's before its importer's).
 * Dynamic imports are validated and never followed. It reads no files,
 * invents no edges, and generates no import map; `serverEnvironment` is left
 * for the integration to set per server.
 *
 * @throws When there is not exactly one client environment, an edge or entry
 * names a missing chunk, a chunk lacks one of its lists, a server environment
 * lists entries, a source key is an absolute file URL, or one source key maps
 * to two URLs.
 */
export function createAssetManifest(build: AssetBuild): BuildAssetsManifest {
    let clients = Object.keys(build.environments).filter(
        name => build.environments[name]!.role === "client",
    );
    if (clients.length !== 1) {
        let found = clients.length === 0 ? "none" : quotedList(clients, "conjunction");
        throw new Error(
            `createAssetManifest() needs exactly one client environment; found ${found}.`,
        );
    }

    let publicUrl = (file: string) => resolvePublicUrl(build.base, file);
    let environments: Record<string, AssetEnvironment> = {};
    let entries: Record<string, string> = {};
    let assets: Record<string, string> = {};

    for (let [name, environment] of Object.entries(build.environments)) {
        validateEnvironment(name, environment);

        let entryChunks = new Map<string, string>();
        for (let [rawKey, chunkId] of Object.entries(environment.entries)) {
            let key = sourceKey(name, rawKey);
            record(entries, key, publicUrl(environment.chunks[chunkId]!.file), name);
            entryChunks.set(key, chunkId);
        }
        for (let [rawKey, file] of Object.entries(environment.assets)) {
            record(assets, sourceKey(name, rawKey), publicUrl(file), name);
        }

        environments[name] = {
            role: environment.role,
            modules: indexModules(name, environment, entryChunks, publicUrl),
        };
    }

    return {
        mode: "build",
        environments,
        entries,
        assets,
        importMap: build.importMap ?? { imports: {} },
    };
}

function validateEnvironment(name: string, environment: AssetBuildEnvironment): void {
    let { chunks } = environment;
    let where = (chunkId: string) => `chunk "${chunkId}" in the "${name}" environment`;

    for (let [chunkId, chunk] of Object.entries(chunks)) {
        for (let list of CHUNK_LISTS) {
            if (!Array.isArray(chunk[list])) {
                throw new Error(`createAssetManifest(): ${where(chunkId)} has no ${list} list.`);
            }
        }
    }
    for (let [chunkId, chunk] of Object.entries(chunks)) {
        let edges = [
            ...chunk.imports.map(target => ["imports", target] as const),
            ...chunk.dynamicImports.map(target => ["dynamically imports", target] as const),
        ];
        for (let [verb, target] of edges) {
            if (!Object.hasOwn(chunks, target)) {
                throw new Error(
                    `createAssetManifest(): ${where(chunkId)} ${verb} "${target}", which is not a chunk in that environment.`,
                );
            }
        }
    }

    let entryKeys = Object.keys(environment.entries);
    if (environment.role === "server" && entryKeys.length > 0) {
        throw new Error(
            `createAssetManifest(): the "${name}" environment lists browser entries, but only the client environment has them.`,
        );
    }
    for (let key of entryKeys) {
        let chunkId = environment.entries[key]!;
        if (!Object.hasOwn(chunks, chunkId)) {
            throw new Error(
                `createAssetManifest(): browser entry "${key}" in the "${name}" environment names chunk "${chunkId}", which is not a chunk in that environment.`,
            );
        }
    }
}

/**
 * Every source module's metadata: the union over each chunk it belongs to,
 * with a browser entry's own chunk first so its preloads lead with its URL.
 */
function indexModules(
    name: string,
    environment: AssetBuildEnvironment,
    entryChunks: ReadonlyMap<string, string>,
    publicUrl: (file: string) => string,
): Record<string, AssetMetadata> {
    let memberships = new Map<string, string[]>();
    let join = (key: string, chunkId: string) => {
        let chunkIds = memberships.get(key) ?? [];
        if (!chunkIds.includes(chunkId)) chunkIds.push(chunkId);
        memberships.set(key, chunkIds);
    };
    for (let [key, chunkId] of entryChunks) join(key, chunkId);
    for (let [chunkId, chunk] of Object.entries(environment.chunks)) {
        for (let rawKey of chunk.modules) join(sourceKey(name, rawKey), chunkId);
    }

    let closures = new Map<string, AssetMetadata>();
    let closureOf = (chunkId: string) => {
        let closure =
            closures.get(chunkId) ?? staticClosure(environment.chunks, chunkId, publicUrl);
        closures.set(chunkId, closure);
        return closure;
    };

    let modules: Record<string, AssetMetadata> = {};
    for (let [key, chunkIds] of memberships) {
        let preloads = new Set<string>();
        let stylesheets = new Set<string>();
        for (let closure of chunkIds.map(closureOf)) {
            for (let href of closure.preloads) preloads.add(href);
            for (let href of closure.stylesheets) stylesheets.add(href);
        }
        modules[key] = { preloads: [...preloads], stylesheets: [...stylesheets] };
    }
    return modules;
}

/**
 * The chunks reachable from `root` through static imports. Preloads are in
 * breadth-first order, so shallower chunks come first; stylesheets are in
 * post-order, so a dependency's styles precede its importer's, matching the
 * order the modules evaluate. Each chunk is visited once, which ends cycles.
 */
function staticClosure(
    chunks: Record<string, AssetBuildChunk>,
    root: string,
    publicUrl: (file: string) => string,
): AssetMetadata {
    let order = [root];
    let queued = new Set(order);
    for (let index = 0; index < order.length; index++) {
        for (let dependency of chunks[order[index]!]!.imports) {
            if (queued.has(dependency)) continue;
            queued.add(dependency);
            order.push(dependency);
        }
    }

    let stylesheets = new Set<string>();
    let visited = new Set<string>();
    let visit = (chunkId: string) => {
        if (visited.has(chunkId)) return;
        visited.add(chunkId);
        let chunk = chunks[chunkId]!;
        for (let dependency of chunk.imports) visit(dependency);
        for (let file of chunk.stylesheets) stylesheets.add(publicUrl(file));
    };
    visit(root);

    return {
        preloads: [...new Set(order.map(chunkId => publicUrl(chunks[chunkId]!.file)))],
        stylesheets: [...stylesheets],
    };
}

function sourceKey(environment: string, rawKey: string): string {
    let key = normalizeSourceKey(rawKey);
    if (key !== null) return key;
    throw new Error(
        `createAssetManifest(): source key "${rawKey}" in the "${environment}" environment is an absolute file URL. Normalize it to a path relative to the project root.`,
    );
}

/** Records `key → url`, rejecting a second, different URL for the same key. */
function record(
    index: Record<string, string>,
    key: string,
    url: string,
    environment: string,
): void {
    let existing = Object.hasOwn(index, key) ? index[key] : undefined;
    if (existing !== undefined && existing !== url) {
        throw new Error(
            `createAssetManifest(): source key "${key}" maps to both "${existing}" and "${url}" in the "${environment}" environment.`,
        );
    }
    index[key] = url;
}

/** Absolute URLs (`/x`, `//host/x`, `https://…`) stay as they are; relative files join the base. */
function resolvePublicUrl(base: string, file: string): string {
    if (/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(file)) return file;
    if (base === "" || base.endsWith("/")) return base + file;
    return `${base}/${file}`;
}
