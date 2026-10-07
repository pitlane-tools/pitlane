import type { AssetsPluginApi } from "@pitlane/assets/vite-plugin";
import type { ESTree, Plugin } from "vite";

import MagicString from "magic-string";
import * as path from "node:path";
import { parseSync } from "vite";

/**
 * Rewrites `export let Name = clientEntry(import.meta.url, …)` to
 * `clientEntry("file:<key>#Name", …)`, where `<key>` is the module's path
 * relative to the project root. The literal is identical in every environment
 * and holds no checkout path, so builds are reproducible across machines.
 * `render({ assets })` resolves it through the asset resolver.
 *
 * Each island a server environment transforms becomes a browser entry. In a
 * build it is emitted as a chunk of the client build with its exports intact,
 * so it has a URL even when no browser code imports it; the plugin is shared
 * across environments so the client build reads what the server builds
 * collected. In dev, the module registers its islands with the asset plugin's
 * {@link AssetsPluginApi}, and clears that registration when it stops
 * declaring any.
 */
export function clientEntryTransform(serverEnvironments: Set<string>): Plugin {
    let islands = new Set<string>();
    let assetsApi: AssetsPluginApi | undefined;
    // `${environment}\0${owner}` for every module currently registered in dev.
    let registered = new Set<string>();

    return {
        name: "pitlane-remix-client-entry-transform",
        sharedDuringBuild: true,
        configResolved(config) {
            assetsApi = config.plugins.find(plugin => plugin.name === "pitlane-assets")?.api;
        },
        buildStart() {
            if (this.environment.config.consumer !== "client") return;
            for (let id of islands) {
                this.emitFile({ type: "chunk", id, preserveSignature: "exports-only" });
            }
        },
        transform: {
            // No code filter: a module that loses its last island has to
            // reach the handler so its dev registration is cleared.
            handler(code, id) {
                let environment = this.environment.name;
                let registers =
                    this.environment.mode === "dev" && serverEnvironments.has(environment);
                let registration = `${environment}\0${id}`;

                let calls =
                    code.includes("clientEntry") && code.includes("import.meta.url")
                        ? findClientEntryCalls(parseSync(id, code).program)
                        : [];
                let file = id.split("?", 1)[0]!;

                if (registers && (calls.length > 0 || registered.has(registration))) {
                    if (!assetsApi) {
                        throw new Error(
                            "[@pitlane/vite-plugin-remix] Island registration needs the " +
                                "`pitlane-assets` plugin, which remix() installs.",
                        );
                    }
                    let entries = calls.length > 0 ? [file] : [];
                    assetsApi.setBrowserEntries({ environment, owner: id, entries });
                    if (entries.length > 0) registered.add(registration);
                    else registered.delete(registration);
                }
                if (calls.length === 0) return;

                if (this.environment.mode === "build" && serverEnvironments.has(environment)) {
                    islands.add(file);
                }

                let key = path
                    .relative(this.environment.config.root, file)
                    .split(path.sep)
                    .join("/");
                let ms = new MagicString(code);
                for (let call of calls) {
                    ms.overwrite(
                        call.metaUrlStart,
                        call.metaUrlEnd,
                        JSON.stringify(`file:${key}#${call.exportName}`),
                    );
                }

                return {
                    code: ms.toString(),
                    map: ms.generateMap({ hires: "boundary", source: id }),
                };
            },
        },
    };
}

interface ClientEntryCall {
    exportName: string;
    metaUrlStart: number;
    metaUrlEnd: number;
}

/**
 * Matches exactly `export let Name = clientEntry(import.meta.url, …)` at the
 * top level, with at least two arguments. Any declaration kind (`let`, `const`,
 * `var`) qualifies; the export name is what matters. Default exports, aliased
 * callees, and non-exported calls are intentionally ignored — the `#Name`
 * fragment requires a named export.
 */
function findClientEntryCalls(program: ESTree.Program): ClientEntryCall[] {
    let results: ClientEntryCall[] = [];

    for (let node of program.body) {
        if (node.type !== "ExportNamedDeclaration") continue;
        if (node.declaration?.type !== "VariableDeclaration") continue;

        for (let declarator of node.declaration.declarations) {
            if (declarator.id.type !== "Identifier") continue;
            if (declarator.init?.type !== "CallExpression") continue;

            let call = declarator.init;

            if (call.callee.type !== "Identifier" || call.callee.name !== "clientEntry") continue;

            if (call.arguments.length < 2) continue;

            let firstArg = call.arguments[0];
            if (
                firstArg.type !== "MemberExpression" ||
                firstArg.object.type !== "MetaProperty" ||
                firstArg.property.type !== "Identifier" ||
                firstArg.property.name !== "url"
            )
                continue;

            results.push({
                exportName: declarator.id.name,
                metaUrlStart: firstArg.start,
                metaUrlEnd: firstArg.end,
            });
        }
    }

    return results;
}
