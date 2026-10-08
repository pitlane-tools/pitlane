import type { Connect, DevEnvironment, Plugin, Rolldown } from "vite";

import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isCSSRequest, normalizePath } from "vite";

import type { BoundaryVerdict, BrowserBoundaryOptions } from "./boundary-policy.ts";

import { createBrowserBoundary, within } from "./boundary-policy.ts";
import { fileModule, sourceKey } from "./entries.ts";
import { observeFoldedFiles } from "./folded-files.ts";

/** A file outside the boundary, by source key, with the module importing it when it is a module. */
interface Refusal {
    file: string;
    importer?: string;
    deniedBy?: string;
}

function describe({ file, importer, deniedBy }: Refusal): string {
    let reason = deniedBy
        ? `matches denyFiles ${JSON.stringify(deniedBy)}`
        : "not in allowFiles or allowPackages";
    return `${file}${importer ? ` (imported by ${importer})` : ""}: ${reason}`;
}

/** Query-free path of a module id or emitted file name. */
function filePath(id: string): string {
    return normalizePath(id.split(/[?#]/, 1)[0]!);
}

/**
 * A page, or an inline script Vite proxies out of one: the boundary governs
 * what a page loads, not the page. An HTML file a module imports is data.
 */
function htmlDocument(id: string): boolean {
    return filePath(id).endsWith(".html") && (!id.includes("?") || /[?&]html-proxy\b/.test(id));
}

/**
 * The server files a build copies into the client output: every stylesheet
 * the server graph imports, except as a string or URL, and the assets its
 * chunks link.
 */
function publishedServerFiles(bundle: Rolldown.OutputBundle): string[] {
    let files: string[] = [];
    for (let output of Object.values(bundle)) {
        if (output.type !== "chunk" || !output.viteMetadata) continue;
        for (let id of output.moduleIds) {
            if (isCSSRequest(id) && !/[?&](?:inline|raw|url)\b/.test(id)) files.push(id);
        }
        for (let fileName of output.viteMetadata.importedAssets) {
            let asset = bundle[fileName];
            if (asset?.type === "asset") files.push(...asset.originalFileNames);
        }
    }
    return files;
}

/**
 * Holds the client graph and every file the build publishes for the browser
 * to `allowFiles`, `allowPackages`, and `denyFiles`, the way `remix/assets`
 * holds the files its asset server answers.
 */
export function browserBoundary(
    options: BrowserBoundaryOptions,
    serverEnvironments: string[],
): Plugin {
    let root = "";
    let inspect: (file: string) => BoundaryVerdict;
    let viteClient = normalizePath(
        dirname(fileURLToPath(import.meta.resolve("vite/dist/client/client.mjs"))),
    );
    /** Build module id → the files a folding plugin read into it. */
    let foldedFiles = new Map<string, Set<string>>();

    function refusal(file: string, importer?: string): Refusal | undefined {
        let verdict = inspect(file);
        if (verdict.allowed) return;
        return {
            file: sourceKey(root, file),
            importer: importer && sourceKey(root, importer),
            deniedBy: verdict.deniedBy,
        };
    }

    /** The real path of the file `path` names from the root, or `undefined` when none exists. */
    function existingFile(path: string): string | undefined {
        let file = resolve(root, filePath(path));
        if (!existsSync(file) || !statSync(file).isFile()) return;
        return normalizePath(realpathSync(file));
    }

    /** The source file a dev request reaches, or `undefined` when Vite itself supplies it. */
    function servedSource(environment: DevEnvironment, file: string): string | undefined {
        if (within(viteClient, file)) return;
        let optimizer = environment.depsOptimizer;
        if (!optimizer?.isOptimizedDepFile(file)) return file;
        let { optimized, discovered } = optimizer.metadata;
        let dependency = [...Object.values(optimized), ...Object.values(discovered)].find(
            info => normalizePath(info.file) === file,
        );
        // A shared chunk is reachable only through the dependency entries checked here.
        return dependency?.src && normalizePath(dependency.src);
    }

    function devRefusal(
        environment: DevEnvironment,
        file: string,
        importer?: string,
    ): Refusal | undefined {
        let source = servedSource(environment, file);
        if (!source) return;
        importer ??=
            [...(environment.moduleGraph.getModulesByFile(file) ?? [])]
                .flatMap(module => [...module.importers])
                .find(module => module.file)?.file ?? undefined;
        return refusal(source, importer);
    }

    return {
        name: "pitlane-assets-boundary",
        sharedDuringBuild: true,
        configResolved(config) {
            root = config.root;
            inspect = createBrowserBoundary(normalizePath(realpathSync(root)), options);
            observeFoldedFiles(config, (environment, plugin, module, file) => {
                // PostCSS plugins report files they only watch, such as Tailwind's
                // content; a stylesheet contains only stylesheets and assets.
                if (plugin === "vite:css" && !isCSSRequest(file) && !config.assetsInclude(file))
                    return;
                if (environment.mode === "build") {
                    let files = foldedFiles.get(module);
                    if (!files) foldedFiles.set(module, (files = new Set()));
                    return void files.add(file);
                }
                if (environment.name !== "client" || environment.mode !== "dev") return;
                let source = existingFile(file);
                let refused = source && devRefusal(environment, source, module);
                if (refused)
                    throw new Error(`[assets] Outside the browser boundary: ${describe(refused)}`);
            });
        },
        configureServer(server) {
            let client = server.environments.client!;
            let { publicDir, base } = server.config;
            server.middlewares.use(((request, _response, next) => {
                let path: string;
                try {
                    path = decodeURIComponent(filePath(request.url ?? "/"));
                } catch {
                    // Vite answers a malformed URL itself; it names no file to check.
                    return next();
                }
                if (base !== "/" && path.startsWith(base)) path = `/${path.slice(base.length)}`;
                // Vite answers its own `/@…` routes, publicDir files, and pages.
                if (path.startsWith("/@") && !path.startsWith("/@fs/")) return next();
                if (publicDir && existsSync(join(publicDir, path))) return next();
                if (htmlDocument(path)) return next();
                let requested = join(root, path);
                if (path.startsWith("/@fs/")) {
                    // `/@fs/C:/…` on Windows, `/@fs/home/…` elsewhere.
                    let fsPath = path.slice("/@fs/".length);
                    requested = /^[A-Za-z]:\//.test(fsPath) ? fsPath : `/${fsPath}`;
                }
                let file = existingFile(requested);
                let refused = file && devRefusal(client, file);
                if (!refused) return next();
                next(new Error(`[assets] Outside the browser boundary: ${describe(refused)}`));
            }) satisfies Connect.NextHandleFunction);
        },
        transform: {
            order: "pre",
            handler(_code, id) {
                let environment = this.environment;
                if (environment.mode !== "dev" || environment.name !== "client" || !fileModule(id))
                    return;
                if (htmlDocument(id)) return;
                let refused = devRefusal(environment, existingFile(id) ?? filePath(id));
                if (refused)
                    throw new Error(`[assets] Outside the browser boundary: ${describe(refused)}`);
            },
        },
        generateBundle(_options, bundle) {
            let name = this.environment.name;
            let published: { path: string; importer?: string }[] = [];
            if (name === "client") {
                // Graph modules, not chunk modules: the asset server refuses an
                // import whose code tree-shaking would have dropped.
                for (let id of this.getModuleIds()) {
                    if (!fileModule(id)) continue;
                    let info = this.getModuleInfo(id);
                    let importer = [
                        ...(info?.importers ?? []),
                        ...(info?.dynamicImporters ?? []),
                    ].find(fileModule);
                    published.push({ path: id, importer });
                }
                for (let output of Object.values(bundle)) {
                    // A stylesheet's sources are graph modules; its original names can be JS.
                    if (output.type !== "asset" || output.names.some(isCSSRequest)) continue;
                    for (let path of output.originalFileNames) published.push({ path });
                }
            } else if (serverEnvironments.includes(name)) {
                for (let path of publishedServerFiles(bundle)) {
                    let importer = this.getModuleInfo(path)?.importers.find(fileModule);
                    published.push({ path, importer });
                }
            }
            let refusals = new Map<string, Refusal>();
            for (let { path, importer } of published) {
                let entries = [
                    { path, importer },
                    ...[...(foldedFiles.get(path) ?? [])].map(file => ({
                        path: file,
                        importer: path,
                    })),
                ];
                for (let entry of entries) {
                    let file = !htmlDocument(entry.path) && existingFile(entry.path);
                    let refused = file && refusal(file, entry.importer);
                    // An emitted asset names no importer; its stylesheet's record does.
                    if (refused && !refusals.get(refused.file)?.importer)
                        refusals.set(refused.file, refused);
                }
            }
            if (refusals.size === 0) return;
            let lines = [...refusals.values()].map(describe);
            this.error(`[assets] Outside the browser boundary:\n  ${lines.join("\n  ")}`);
        },
    };
}
