import type { ResolvedConfig, Rolldown } from "vite";

import { isCSSRequest } from "vite";

import type { AssetBuildEnvironment, ImportMap } from "../types.ts";

import { fileModule, sourceKey } from "./entries.ts";

export interface CapturedOutput {
    graph: AssetBuildEnvironment;
    bundle: Rolldown.OutputBundle;
    outDir: string;
}

export function captureOutput(
    bundle: Rolldown.OutputBundle,
    config: ResolvedConfig,
    role: "client" | "server",
    assetReferences: Map<string, string>,
): AssetBuildEnvironment {
    let graph: AssetBuildEnvironment = {
        role,
        chunks: Object.create(null),
        entries: Object.create(null),
        assets: Object.create(null),
    };
    // Vite keeps this original filename even when the combined CSS asset is renamed.
    let globalStylesheets = config.build.cssCodeSplit
        ? []
        : Object.values(bundle).flatMap(output =>
              output.type === "asset" && output.originalFileNames.includes("style.css")
                  ? [output.fileName]
                  : [],
          );
    for (let output of Object.values(bundle)) {
        if (output.type === "asset") {
            let stylesheet = output.names.some(isCSSRequest);
            for (let file of output.originalFileNames) {
                // Extracted CSS can name its importing JS module, not a source stylesheet.
                if (stylesheet && !isCSSRequest(file)) continue;
                let key = fileModule(file)
                    ? sourceKey(config.root, file)
                    : file.replace(/^\.\//, "");
                graph.assets[key] = output.fileName;
            }
            continue;
        }
        graph.chunks[output.fileName] = {
            file: output.fileName,
            modules: [
                ...new Set(
                    output.moduleIds.filter(fileModule).map(id => sourceKey(config.root, id)),
                ),
            ],
            imports: output.imports.filter(id => bundle[id]?.type === "chunk"),
            dynamicImports: output.dynamicImports.filter(id => bundle[id]?.type === "chunk"),
            stylesheets: [...globalStylesheets, ...(output.viteMetadata?.importedCss ?? [])],
        };
        if (
            role === "client" &&
            output.isEntry &&
            output.facadeModuleId &&
            fileModule(output.facadeModuleId)
        ) {
            graph.entries[sourceKey(config.root, output.facadeModuleId)] = output.fileName;
        }
    }
    for (let [key, file] of assetReferences) graph.assets[key] = file;
    return graph;
}

export function captureImportMap(bundle: Rolldown.OutputBundle, fileName: string): ImportMap {
    let output = bundle[fileName];
    if (output?.type !== "asset") {
        throw new Error(
            `[assets] The client build did not emit its configured import map "${fileName}".`,
        );
    }
    let text =
        typeof output.source === "string" ? output.source : new TextDecoder().decode(output.source);
    return JSON.parse(text) as ImportMap;
}

/**
 * The public URL `renderBuiltUrl` chooses for a built file. A server document
 * has no importer to be relative to, so `{ relative: true }` keeps the
 * base-joined path.
 */
export function publicFile(config: ResolvedConfig, file: string): string {
    let render = config.experimental.renderBuiltUrl;
    if (!render) return file;
    let rendered = render(file, { type: "asset", hostType: "html", hostId: "", ssr: true });
    if (typeof rendered === "string") return rendered;
    if (rendered && "runtime" in rendered && rendered.runtime) {
        throw new Error(
            "[assets] renderBuiltUrl must return a URL for server HTML; runtime JavaScript cannot be serialized in an asset manifest.",
        );
    }
    return file;
}
