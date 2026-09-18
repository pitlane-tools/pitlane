import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createRunnableDevEnvironment,
    createServer,
    type Plugin,
    type UserConfig,
    type ViteDevServer,
} from "vite";

import type { LoadedEntry } from "./types.ts";

import { type Body, BODY_PREFIX, manifestModule } from "./codegen.ts";
import { closePrebuild, openPrebuild, unfinishedContent } from "./prebuild.ts";

const MANIFEST_OWNER = "@pitlane/content";
const MANIFEST_SPECIFIER = `${MANIFEST_OWNER}/internal/manifest`;
const VIRTUAL_MANIFEST = "\0pitlane-content/manifest";

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
    let bodies = new Map<string, Body>();
    let watched: string[] = [];
    let resolution: Resolution = {};
    let server: ViteDevServer | undefined;
    let pending: Promise<void> | undefined;
    let queue: Promise<void> = Promise.resolve();

    async function prebuild(warn: (message: string) => void) {
        let loaded = await inPrebuildServer(root, entry, resolution, paths => {
            // Captured even when the prebuild goes on to throw. Otherwise a
            // failed *first* prebuild leaves nothing watched, every later edit
            // is ignored, and fixing the file needs a server restart — the
            // worst moment to ask for one.
            watched = [...new Set([...watched, ...paths])];
            for (let path of watched) server?.watcher.add(path);
        });
        collections = loaded.collections;
        watched = loaded.watched;
        for (let path of watched) server?.watcher.add(path);
        for (let name of loaded.configuredSatteri) {
            warn(
                `Collection "${name}" configures loader options.satteri, but content() ` +
                    "prebuilt it, so vite-plugin-satteri renders it and those options do " +
                    "nothing. Move the plugins into satteri() in your Vite config, or drop " +
                    "content() for this collection.",
            );
        }
    }

    /**
     * Prebuilds once, and again only after a content change invalidated it.
     *
     * Runs strictly one at a time. Prebuild mode is a process-global handshake
     * with `createContent`, so a second run overlapping the first would close
     * the channel underneath it and leave the loaders resolving against the
     * wrong root.
     */
    function ready(warn: (message: string) => void) {
        let run = () => prebuild(warn);
        pending ??= queue = queue.then(run, run);
        return pending;
    }

    return {
        name: "pitlane-content",
        // Runs after the Markdown compiler so the `transform` below can see
        // whether anything actually compiled a body module.
        enforce: "post",

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
            if (this.environment.config.command === "build") {
                await ready(message => this.warn(message));
            }
        },

        configureServer(created) {
            server = created;
            created.watcher.on("all", async (_event, changed) => {
                if (!isWatched(watched, changed)) return;
                pending = undefined;
                // A rejection here would escape into chokidar, which ignores the
                // promise: the reload would be skipped, the browser would keep
                // serving stale content, and the editor would show nothing. Log
                // it and reload anyway, so the next request surfaces it through
                // Vite's own error overlay.
                try {
                    await ready(message => created.config.logger.warn(message));
                } catch (error) {
                    created.config.logger.error(String(error));
                }
                invalidate(created, entry);
                created.hot.send({ type: "full-reload" });
            });
        },

        // Vite consults `resolveId` only for ids its own resolver cannot
        // handle, which is exactly the virtual body modules and the published
        // manifest specifier. The manifest's real path resolves natively, so
        // it is replaced in `load` rather than redirected here.
        //
        // A body module also has to answer for what the document inside it
        // imports. Its id is virtual, so `./note.tsx` has no directory to
        // resolve against, and the build fails on a document the runtime path
        // renders. Resolving from the entry's own file is what makes the same
        // relative specifier mean the same thing on both paths.
        async resolveId(source, importer) {
            if (source === MANIFEST_SPECIFIER) return VIRTUAL_MANIFEST;
            if (source.startsWith(BODY_PREFIX)) return source;

            if (importer?.startsWith(BODY_PREFIX) && source.startsWith(".")) {
                let filePath = bodies.get(importer)?.filePath;
                if (filePath === undefined) return undefined;
                // Vite's own root, not `contentRoot()`: the prebuild channel
                // that answers for that is closed by the time the main build
                // resolves anything, and it would fall back to the working
                // directory.
                let from = resolve(root, filePath);
                return await this.resolve(resolve(dirname(from), source), from, {
                    skipSelf: true,
                });
            }
            return undefined;
        },

        /**
         * Catches the one misconfiguration that would otherwise surface as a
         * JavaScript tokenizer error on a virtual path.
         *
         * A body module's id ends in `.md` or `.mdx` and its contents are raw
         * Markdown. If it reaches here unchanged, no plugin claimed it, and the
         * bundler is about to parse prose as JavaScript. Every other
         * misconfiguration in this package names its own fix; this one sits on
         * the documented adoption path, so it gets the same treatment.
         */
        transform(code, id) {
            if (!id.startsWith(BODY_PREFIX) || code !== bodies.get(id)?.source) return undefined;
            throw new Error(
                `Nothing compiled the Markdown in "${id.slice(BODY_PREFIX.length)}". ` +
                    "Add vite-plugin-satteri to your Vite config, before remix():\n" +
                    '  satteri({ mdx: { jsxImportSource: "remix/ui" }, ' +
                    "mdastPlugins: [headings()] })",
            );
        },

        async load(id) {
            if (id === VIRTUAL_MANIFEST || isManifestModule(id)) {
                await ready(message => this.warn(message));
                return manifestModule(collections, bodies, await markdownHeadings(collections));
            }
            if (id.startsWith(BODY_PREFIX)) {
                await ready(message => this.warn(message));
                return bodies.get(id)?.source;
            }
            return undefined;
        },
    };
}

/**
 * The heading list for every Markdown entry, measured the way the runtime
 * measures it.
 *
 * `vite-plugin-satteri` compiles a `.md` body to an HTML string and exports
 * nothing else, so the list has to be taken here or the prebuilt path has none
 * at all. MDX needs no such help: it compiles to a module that exports its own.
 */
async function markdownHeadings(collections: Record<string, LoadedEntry[]>) {
    let measured = new Map<string, unknown>();
    let markdown = Object.entries(collections).flatMap(([collection, loaded]) =>
        loaded.filter(entry => entry.body?.format === "md").map(entry => ({ collection, entry })),
    );
    if (markdown.length === 0) return measured;

    let [satteri, { headings }] = await Promise.all([import("satteri"), import("./satteri.ts")]);
    for (let { collection, entry } of markdown) {
        let result = await satteri.markdownToHtml(entry.body!.source, {
            features: { frontmatter: true },
            mdastPlugins: [headings()],
        });
        let data = result.data as { headings?: unknown };
        measured.set(`${BODY_PREFIX}${collection}/${entry.id}.md`, data.headings);
    }
    return measured;
}

function isWatched(watched: string[], changed: string) {
    let path = posix(changed);
    // Both sides are normalized: `watched` comes from `resolve()`, which yields
    // native separators, and a half-normalized comparison never matches on
    // Windows, which would make dev reload silently dead there.
    return watched.some(base => path === posix(base) || path.startsWith(`${posix(base)}/`));
}

function posix(path: string) {
    return path.replace(/\\/g, "/");
}

/**
 * Whether a resolved id is this package's manifest module.
 *
 * Located relative to this module rather than matched by name: the plugin and
 * the manifest ship side by side, in `src` during development and in `dist`
 * once packed, so one relative lookup identifies it exactly. A suffix match
 * either misses the workspace link Vite resolves through or claims an
 * application's own `content/src/manifest.ts`.
 */
const MANIFEST_PATHS = new Set(
    ["./manifest.ts", "./manifest.mjs"].map(name =>
        posix(fileURLToPath(new URL(name, import.meta.url))),
    ),
);

function isManifestModule(id: string) {
    return MANIFEST_PATHS.has(posix(id).split("?")[0] ?? "");
}

/**
 * Invalidates the manifest, the body modules, and every module that imported
 * them, so the next request re-evaluates the collections rather than reusing
 * the entries the previous prebuild produced.
 */
function invalidate(server: ViteDevServer, entry: string) {
    // The entry module is invalidated alongside the emitted ones because a
    // prebuild that threw never registered a manifest node for this to find,
    // and the entry's own failed evaluation is what would otherwise be served
    // from cache forever.
    let entryPath = posix(entry).replace(/^\/+/, "");
    for (let environment of Object.values(server.environments)) {
        let graph = environment.moduleGraph;
        let stale = [...graph.idToModuleMap.values()].filter(node => {
            let id = posix(node.id ?? "");
            return isEmitted(id) || id.endsWith(`/${entryPath}`);
        });
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
async function inPrebuildServer(
    root: string,
    entry: string,
    resolution: Resolution,
    onWatched: (paths: string[]) => void,
) {
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
        return await execute(server, root, entry, onWatched);
    } finally {
        await server.close();
    }
}

async function execute(
    server: ViteDevServer,
    root: string,
    entry: string,
    onWatched: (paths: string[]) => void,
) {
    let recorded = openPrebuild(root);
    let unfinished = false;
    try {
        await server.ssrLoadModule(entry.startsWith("/") ? entry : `/${entry}`);
    } catch (error) {
        let cause = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load the content entry "${entry}" in ${root}: ${cause}`, {
            cause: error,
        });
    } finally {
        unfinished = unfinishedContent();
        onWatched([...recorded.watched]);
        closePrebuild();
    }

    if (unfinished) {
        throw new Error(
            `The content entry "${entry}" declares collections without awaiting ` +
                "createContent, so the build cannot see them. Add `await`: " +
                "`export let content = await createContent(...)`.",
        );
    }

    let collections: Record<string, LoadedEntry[]> = {};
    for (let [name, entries] of recorded.collections) {
        collections[name] = entries as LoadedEntry[];
    }
    return {
        collections,
        watched: [...recorded.watched],
        configuredSatteri: [...recorded.configuredSatteri],
    };
}
