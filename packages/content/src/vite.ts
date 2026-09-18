import {
    createRunnableDevEnvironment,
    createServer,
    type Plugin,
    type UserConfig,
    type ViteDevServer,
} from "vite";

import type { LoadedEntry } from "./types.ts";

import { closePrebuild, openPrebuild } from "./prebuild.ts";

const MANIFEST_OWNER = "@pitlane/content";
const MANIFEST_SPECIFIER = `${MANIFEST_OWNER}/internal/manifest`;
const VIRTUAL_MANIFEST = "\0pitlane-content/manifest";
const BODY_PREFIX = "\0pitlane-content/entry/";
/**
 * Where the runtime reads the manifest.
 *
 * The emitted module assigns this rather than exporting a value, and it
 * assigns it directly rather than calling into the package: the module it
 * replaces sits beside `prebuild.ts` in source and beside a hashed chunk in a
 * published build, so no relative specifier is right in both.
 */
const MANIFEST_SYMBOL = "pitlane.content.manifest";

/** The slice of resolution the prebuild server inherits. */
type Resolution = NonNullable<UserConfig["resolve"]>;

/**
 * Resolves content collections during the build and inlines them.
 *
 * `entry` names the module that declares the collections, and defaults to
 * `app/content.ts`. It is an ordinary application module rather than a
 * configuration file this plugin owns; being told which module it is is the
 * whole of the configuration.
 *
 * The result is a host with no filesystem serving the collections the
 * application declared, with no change to the declarations.
 */
export function content(options?: { entry?: string }): Plugin {
    let entry = options?.entry ?? "app/content.ts";
    let root = process.cwd();
    let collections: Record<string, LoadedEntry[]> = {};
    let bodies = new Map<string, string>();
    let watched: string[] = [];
    let resolution: Resolution = {};
    let server: ViteDevServer | undefined;
    let pending: Promise<void> | undefined;
    let queue: Promise<void> = Promise.resolve();

    async function prebuild() {
        let loaded = await inPrebuildServer(root, entry, resolution);
        collections = loaded.collections;
        watched = loaded.watched;
        for (let path of watched) server?.watcher.add(path);
    }

    /**
     * Prebuilds once, and again only after a content change invalidated it.
     *
     * Runs strictly one at a time. Prebuild mode is a process-global handshake
     * with `createContent`, so a second run overlapping the first would close
     * the channel underneath it and leave the loaders resolving against the
     * wrong root.
     */
    function ready() {
        pending ??= queue = queue.then(prebuild, prebuild);
        return pending;
    }

    return {
        name: "pitlane-content",

        /**
         * A server build externalizes dependencies by default, which would
         * leave `@pitlane/content` importing the manifest it ships — the one
         * that exports `null` — rather than the one emitted below. The package
         * has to be bundled for the replacement to reach the runtime at all.
         */
        config() {
            return {
                environments: {
                    ssr: { resolve: { noExternal: [MANIFEST_OWNER] } },
                },
                ssr: { noExternal: [MANIFEST_OWNER] },
            };
        },

        configResolved(config) {
            root = config.root;
            // The prebuild server runs without the project's config file, so
            // that it cannot recurse into this plugin. Carrying the resolved
            // resolution across is what keeps aliases and workspace links
            // working inside it.
            resolution = {
                alias: config.resolve.alias,
                dedupe: config.resolve.dedupe,
                extensions: config.resolve.extensions,
                mainFields: config.resolve.mainFields,
                preserveSymlinks: config.resolve.preserveSymlinks,
            };
        },

        async buildStart() {
            // A build resolves the collections before anything asks for the
            // manifest, so a loader failure fails the build. In dev the first
            // request is early enough, and prebuilding here would deadlock:
            // the module runner is not ready until the server is.
            if (this.environment.config.command === "build") await ready();
        },

        configureServer(created) {
            server = created;
            created.watcher.on("all", async (_event, changed) => {
                if (!isWatched(watched, changed)) return;
                pending = undefined;
                await ready();
                invalidate(created);
                created.hot.send({ type: "full-reload" });
            });
        },

        // Vite consults `resolveId` only for ids its own resolver cannot
        // handle, which is exactly the virtual body modules and the published
        // manifest specifier. The manifest's real path resolves natively, so
        // it is replaced in `load` rather than redirected here.
        resolveId(source) {
            if (source === MANIFEST_SPECIFIER) return VIRTUAL_MANIFEST;
            if (source.startsWith(BODY_PREFIX)) return source;
            return undefined;
        },

        async load(id) {
            if (id === VIRTUAL_MANIFEST || isManifestModule(id)) {
                await ready();
                return manifestModule(collections, bodies);
            }
            if (id.startsWith(BODY_PREFIX)) {
                await ready();
                return bodies.get(id);
            }
            return undefined;
        },
    };
}

function isWatched(watched: string[], changed: string) {
    let path = changed.replace(/\\/g, "/");
    return watched.some(base => path === base || path.startsWith(`${base}/`));
}

function isManifestModule(id: string) {
    let path = (id.replace(/\\/g, "/").split("?")[0] ?? "").toLowerCase();
    return path.endsWith("/content/dist/manifest.mjs") || path.endsWith("/content/src/manifest.ts");
}

/**
 * Invalidates the manifest, the body modules, and every module that imported
 * them, so the next request re-evaluates the collections rather than reusing
 * the entries the previous prebuild produced.
 */
function invalidate(server: ViteDevServer) {
    for (let environment of Object.values(server.environments)) {
        let graph = environment.moduleGraph;
        let stale = [...graph.idToModuleMap.values()].filter(node => isEmitted(node.id ?? ""));
        let seen = new Set(stale);
        while (stale.length > 0) {
            let node = stale.pop()!;
            graph.invalidateModule(node);
            for (let importer of node.importers) {
                if (seen.has(importer)) continue;
                seen.add(importer);
                stale.push(importer);
            }
        }
    }
}

function isEmitted(id: string) {
    return id === VIRTUAL_MANIFEST || id.startsWith(BODY_PREFIX) || isManifestModule(id);
}

/**
 * Runs the content entry through Vite's own module runner, so TypeScript,
 * aliases, and `vite.config.ts` resolution all apply.
 *
 * `createContent` sees prebuild mode and populates every `ContentLoader`
 * collection eagerly, with the filesystem available. A `LiveLoader` has no
 * `load` to call, so the build cannot execute one even in principle, which is
 * why it makes no network calls on a live collection's behalf.
 */
async function inPrebuildServer(root: string, entry: string, resolution: Resolution) {
    let server = await createServer({
        root,
        configFile: false,
        logLevel: "silent",
        resolve: resolution,
        server: { middlewareMode: true, watch: null },
        environments: {
            ssr: {
                dev: {
                    createEnvironment: (name, config) => createRunnableDevEnvironment(name, config),
                },
            },
        },
    });
    try {
        return await execute(server, root, entry);
    } finally {
        await server.close();
    }
}

async function execute(server: ViteDevServer, root: string, entry: string) {
    let recorded = openPrebuild(root);
    try {
        await server.ssrLoadModule(entry.startsWith("/") ? entry : `/${entry}`);
    } catch (error) {
        let cause = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load the content entry "${entry}" in ${root}: ${cause}`, {
            cause: error,
        });
    } finally {
        closePrebuild();
    }

    let collections: Record<string, LoadedEntry[]> = {};
    let watched = new Set<string>();
    for (let [name, entries] of recorded) {
        let loaded = entries as LoadedEntry[];
        collections[name] = loaded;
        for (let entry of loaded) {
            if (entry.filePath) watched.add(directoryOf(entry.filePath));
        }
    }
    return { collections, watched: [...watched] };
}

function directoryOf(filePath: string) {
    let path = filePath.replace(/\\/g, "/");
    return path.slice(0, path.lastIndexOf("/"));
}

/**
 * The manifest module, as JavaScript source.
 *
 * Every value is a literal so the bundler can see it, and a `Date` is written
 * as `new Date("…")` so a `coerce.date()` schema finds a `Date` rather than the
 * string it was authored as. Each body is a static import of a virtual module,
 * which is the step no runtime cleverness replaces: a component is code, and
 * only the bundler turns source into code.
 */
function manifestModule(collections: Record<string, LoadedEntry[]>, bodies: Map<string, string>) {
    let imports: string[] = [];
    bodies.clear();

    let entries = Object.entries(collections).map(([name, loaded]) => {
        let items = loaded.map(entry => {
            let fields = [`id: ${literal(entry.id)}`, `data: ${literal(entry.data)}`];
            if (entry.filePath) fields.push(`filePath: ${literal(entry.filePath)}`);
            if (entry.body) {
                let binding = `body${bodies.size}`;
                let id = `${BODY_PREFIX}${name}/${entry.id}.${entry.body.format}`;
                bodies.set(id, entry.body.source);
                imports.push(`import * as ${binding} from ${literal(id)};`);
                fields.push(`body: ${bodyExpression(entry.body.format, binding)}`);
            }
            return `{ ${fields.join(", ")} }`;
        });
        return `    ${literal(name)}: [${items.join(", ")}]`;
    });

    return [
        ...imports,
        `globalThis[Symbol.for(${literal(MANIFEST_SYMBOL)})] = {`,
        entries.join(",\n"),
        "};",
        "",
    ].join("\n");
}

/**
 * MDX compiles to a module carrying a component and a heading list. Markdown
 * compiles to an HTML string, which `vite-plugin-satteri` exports as `html`.
 */
function bodyExpression(format: "md" | "mdx", binding: string) {
    if (format === "mdx") return `{ format: "mdx", module: ${binding} }`;
    return `{ format: "md", html: ${binding}.html ?? ${binding}.default }`;
}

/** Writes a value as JavaScript source, preserving what JSON would flatten. */
function literal(value: unknown): string {
    if (value instanceof Date) return `new Date(${JSON.stringify(value.toISOString())})`;
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "bigint") return `${value}n`;
    if (Array.isArray(value)) return `[${value.map(literal).join(", ")}]`;
    if (typeof value === "object") {
        let fields = Object.entries(value).map(
            ([key, nested]) => `${JSON.stringify(key)}: ${literal(nested)}`,
        );
        return `{ ${fields.join(", ")} }`;
    }
    return JSON.stringify(value) ?? "undefined";
}
