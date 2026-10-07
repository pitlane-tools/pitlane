/**
 * An import map as the HTML standard defines it: specifier mappings, optional
 * scoped mappings, and optional integrity metadata.
 */
export interface ImportMap {
    imports: Record<string, string>;
    scopes?: Record<string, Record<string, string>>;
    integrity?: Record<string, string>;
}

/**
 * What a browser needs to load one script entry: its URL, the URLs worth
 * `modulepreload` hints, and the import map its imports resolve through.
 *
 * Structurally the `ScriptEntry` of `remix/assets`.
 */
export interface ScriptEntry {
    /** The public URL of the entry module. */
    href: string;
    /** The entry module's URL followed by its static JavaScript dependencies, shallowest first. */
    preloads: string[];
    /** The complete client import map, or `{ imports: {} }` when chunk import maps are disabled. */
    importMap: ImportMap;
}

/** The JavaScript and CSS one source module requires in one environment. */
export interface AssetMetadata {
    /** Public URLs of the chunks holding the module and their static JavaScript dependencies. */
    preloads: string[];
    /** Public URLs of the stylesheets those chunks require. */
    stylesheets: string[];
}

/** Every source module observed in one environment's graph, keyed by portable source key. */
export interface AssetEnvironment {
    role: "client" | "server";
    modules: Record<string, AssetMetadata>;
}

/** The manifest a production build produces. */
export interface BuildAssetsManifest {
    mode: "build";
    environments: Record<string, AssetEnvironment>;
    /** Browser-entry source keys mapped to public URLs. */
    entries: Record<string, string>;
    /** Non-script asset source keys mapped to public URLs. */
    assets: Record<string, string>;
    importMap: ImportMap;
    /** The server environment this manifest was written for. */
    serverEnvironment?: string;
}

/** The manifest a development server supplies, refreshed as the graph changes. */
export interface DevAssetsManifest {
    mode: "dev";
    environments: Record<string, AssetEnvironment>;
    /** Browser-entry source keys mapped to development URLs. */
    entries: Record<string, string>;
    /** Non-script asset source keys mapped to development URLs. */
    assets: Record<string, string>;
    /** The server environment this manifest was written for. */
    serverEnvironment?: string;
}

/**
 * Everything `createAssetResolver` accepts. `{ mode: "unavailable" }` is
 * what `@pitlane/assets/manifest` exports when no build integration replaced it.
 */
export type AssetsManifest = BuildAssetsManifest | DevAssetsManifest | { mode: "unavailable" };

/**
 * A bundler's output, normalized for `createAssetManifest`.
 *
 * Paths and filenames are already portable: source keys are relative to the
 * project root, and `file`/`stylesheets` are emitted filenames relative to
 * `base` or absolute public URLs.
 */
export interface AssetBuild {
    /** The public base relative emitted filenames resolve against, such as `/` or `https://cdn.example/app/`. */
    base: string;
    /** Every participating environment by name. Exactly one has the client role. */
    environments: Record<string, AssetBuildEnvironment>;
    /** The import map the bundler generated for the client build, when it generated one. */
    importMap?: ImportMap;
}

/** One environment's output graph. */
export interface AssetBuildEnvironment {
    role: "client" | "server";
    /** Emitted chunks by opaque, environment-local identity. */
    chunks: Record<string, AssetBuildChunk>;
    /** Browser-entry source keys mapped to chunk identities. Populated only on the client. */
    entries: Record<string, string>;
    /** Source keys mapped to emitted non-script files. */
    assets: Record<string, string>;
}

/** One emitted JavaScript chunk. */
export interface AssetBuildChunk {
    /** The emitted filename, or an absolute public URL. */
    file: string;
    /** Source keys of every module the chunk contains. */
    modules: string[];
    /** Chunk identities this chunk imports statically, in import order. */
    imports: string[];
    /** Chunk identities this chunk imports dynamically. */
    dynamicImports: string[];
    /** Emitted stylesheet filenames, or absolute public URLs, the chunk requires. */
    stylesheets: string[];
}
