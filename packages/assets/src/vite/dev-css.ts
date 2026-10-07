import type { Plugin, ResolvedConfig } from "vite";

import MagicString from "magic-string";
import { fileURLToPath } from "node:url";
import { isCSSRequest, normalizePath } from "vite";

function linkedStylesheetLookup(config: ResolvedConfig): string {
    return `
function pitlaneStyleKey(href) {
  const url = new URL(href, document.baseURI);
  url.searchParams.delete("t");
  url.searchParams.delete("direct");
  url.searchParams.sort();
  return url.href;
}
function pitlaneHasLinkedStylesheet(id) {
  const root = ${JSON.stringify(config.root + "/")};
  const path = id.startsWith(root) ? id.slice(root.length) : "@fs/" + id.replace(/^\\//, "");
  const key = pitlaneStyleKey(${JSON.stringify(config.base)} + path);
  for (const link of document.querySelectorAll('link[rel="stylesheet"][href]')) {
    if (pitlaneStyleKey(link.href) === key) return true;
  }
  return false;
}
`;
}

export function assetStyles(): Plugin {
    let config: ResolvedConfig;
    let clientPath = normalizePath(
        fileURLToPath(import.meta.resolve("vite/dist/client/client.mjs")),
    );
    return {
        name: "pitlane-assets-css",
        apply: "serve",
        configResolved(resolved) {
            config = resolved;
        },
        configureServer(server) {
            server.middlewares.use((request, _response, next) => {
                // Vite's link refresh serializes Vue's empty lang.css parameter with '='.
                if (
                    request.headers.accept?.includes("text/css") &&
                    request.url?.includes("&lang.css=")
                ) {
                    request.url = request.url.replace("&lang.css=", "?lang.css");
                }
                next();
            });
        },
        transform: {
            order: "post",
            handler(code, id) {
                if (id === clientPath) {
                    let signature = "function updateStyle(id, content) {";
                    let position = code.indexOf(signature);
                    if (position === -1) {
                        throw new Error(
                            "[assets] This Vite client does not expose the expected CSS update function. Use a supported Vite version.",
                        );
                    }
                    let transformed = new MagicString(code);
                    transformed.prepend(linkedStylesheetLookup(config));
                    transformed.appendLeft(
                        position + signature.length,
                        "\nif (pitlaneHasLinkedStylesheet(id)) return;\n",
                    );
                    return {
                        code: transformed.toString(),
                        map: transformed.generateMap({ hires: true }),
                    };
                }
                if (
                    this.environment.mode !== "dev" ||
                    this.environment.name !== "client" ||
                    !isCSSRequest(id) ||
                    !/[?&]direct\b/.test(id)
                )
                    return;
                let module = this.environment.moduleGraph.getModuleById(id);
                if (module) module.isSelfAccepting = true;
            },
        },
    };
}
