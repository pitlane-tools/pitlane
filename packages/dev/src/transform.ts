import type { Program } from "oxc-parser";
import type { Plugin } from "vite";

import MagicString from "magic-string";
import { parseSync } from "oxc-parser";

const CLIENT_ENTRY_PATTERN = /\bclientEntry\b/;

/**
 * Rewrites `export const Name = clientEntry(import.meta.url, …)` so the first
 * argument resolves to a production asset URL carrying an `#ExportName`
 * fragment.
 *
 * - In server environments the module gains one
 *   `import ___clientEntryAssets from "<id>?assets=client"` prepend, and each
 *   call site becomes `___clientEntryAssets.entry + "#Name"`.
 * - In the client environment `import.meta.url` already resolves to the chunk
 *   URL at runtime, so each call site becomes `import.meta.url + "#Name"`.
 *
 * One code path runs everywhere — dev and build, generic Vite and Vite+.
 * (Rolldown's native `meta.ast`/`meta.magicString` fast path was tried and
 * reverted: unfinished types, never exercised. Revisit once it is real.)
 */
export function clientEntryTransform(serverEnvironments: Set<string>): Plugin {
    return {
        name: "remix-client-entry-transform",
        transform: {
            filter: {
                code: {
                    include: CLIENT_ENTRY_PATTERN,
                },
            },
            handler(code, id) {
                if (!code.includes("import.meta.url")) return;
                let ast = parseSync(id, code).program;

                let calls = findClientEntryCalls(ast);
                if (calls.length === 0) return;

                let ms = new MagicString(code);
                let isServer = serverEnvironments.has(this.environment.name);

                if (isServer) {
                    // Server: import ?assets=client to get the resolved client entry URL
                    ms.prepend(`import ___clientEntryAssets from "${id}?assets=client";\n`);
                    for (let call of calls) {
                        ms.overwrite(
                            call.metaUrlStart,
                            call.metaUrlEnd,
                            `___clientEntryAssets.entry + "#${call.exportName}"`,
                        );
                    }
                } else {
                    // Client: import.meta.url already resolves to the chunk URL.
                    // Just append #ExportName so clientEntry gets the required fragment.
                    for (let call of calls) {
                        ms.overwrite(
                            call.metaUrlStart,
                            call.metaUrlEnd,
                            `import.meta.url + "#${call.exportName}"`,
                        );
                    }
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
 * Matches exactly `export const Name = clientEntry(import.meta.url, …)` at the
 * top level, with at least two arguments. Default exports, aliased callees,
 * and non-exported calls are intentionally ignored — the `#Name` fragment
 * requires a named export.
 */
function findClientEntryCalls(program: Program): ClientEntryCall[] {
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
