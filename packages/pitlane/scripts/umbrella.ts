import { subset } from "semver";
import { parseSync } from "vite";

import type { WorkspacePackage } from "./workspace.ts";

/**
 * What a re-exported module is: an ES module, which the umbrella re-exports
 * binding for binding, or an ambient declaration file, which has no bindings
 * and is pulled in by reference.
 */
export type ExportShape = { kind: "module"; hasDefault: boolean } | { kind: "ambient" };

/** The shape of the module `source`, parsed as `filename`. */
export function exportShape(source: string, filename: string): ExportShape {
    let { module, errors } = parseSync(filename, source);
    if (errors.length > 0) {
        throw new Error(`${filename} does not parse: ${errors[0]!.message}`);
    }
    if (!module.hasModuleSyntax) return { kind: "ambient" };

    let hasDefault = module.staticExports.some(statement =>
        statement.entries.some(
            ({ exportName }) =>
                exportName.kind === "Default" ||
                (exportName.kind === "Name" && exportName.name === "default"),
        ),
    );
    return { kind: "module", hasDefault };
}

/**
 * The source of the umbrella module that re-exports `target` from package
 * `owner`. A module also adds `owner` to the global set that lets a package
 * name itself the way the app imports it, as `@pitlane/content`'s errors do.
 */
export function stubSource(target: string, owner: string, shape: ExportShape): string {
    let lines = ["// Generated from manifest.json by `vp run generate`. Do not edit."];
    if (shape.kind === "ambient") {
        lines.push(`/// <reference types=${JSON.stringify(target)} />`);
    } else {
        lines.push(`export * from ${JSON.stringify(target)};`);
        if (shape.hasDefault) lines.push(`export { default } from ${JSON.stringify(target)};`);
        lines.push(
            "",
            'let reached = Symbol.for("pitlane.umbrella.packages");',
            "let globals = globalThis as Record<symbol, Set<string> | undefined>;",
            `(globals[reached] ??= new Set()).add(${JSON.stringify(owner)});`,
        );
    }
    return `${lines.join("\n")}\n`;
}

type PeerSource = Pick<WorkspacePackage, "name" | "peerDependencies" | "peerDependenciesMeta">;

/**
 * The peer dependencies the umbrella declares for `packages`. Installing the
 * umbrella installs every package, whichever subpaths an app imports, so each
 * peer takes the narrowest range one of them asks for, and is optional only
 * when every package that names it lets it be.
 */
export function liftPeers(packages: PeerSource[]): {
    peerDependencies: Record<string, string>;
    peerDependenciesMeta: Record<string, { optional: true }>;
} {
    let ranges = new Map<string, { range: string; from: string }>();
    let required = new Set<string>();

    for (let { name, peerDependencies = {}, peerDependenciesMeta = {} } of packages) {
        for (let [peer, range] of Object.entries(peerDependencies)) {
            if (!peerDependenciesMeta[peer]?.optional) required.add(peer);

            let current = ranges.get(peer);
            if (!current || (range !== current.range && subset(range, current.range))) {
                ranges.set(peer, { range, from: name });
            } else if (!subset(current.range, range)) {
                throw new Error(
                    `Cannot lift ${peer}: ${current.from} asks for ${current.range} and ${name} ` +
                        `for ${range}, and neither range contains the other.`,
                );
            }
        }
    }

    let peers = [...ranges.keys()].sort();
    return {
        peerDependencies: Object.fromEntries(peers.map(peer => [peer, ranges.get(peer)!.range])),
        peerDependenciesMeta: Object.fromEntries(
            peers.filter(peer => !required.has(peer)).map(peer => [peer, { optional: true }]),
        ),
    };
}
