import type { WorkspacePackage } from "./workspace.ts";

/** Each `pitlane/*` subpath and the `@pitlane/*` export it re-exports. */
export type Manifest = Map<string, string>;

/** Subpaths a package exposes only to code it generates, which the umbrella never re-exports. */
const INTERNAL = /^\.\/internal(\/|$)/;

/** A manifest from `manifest.json`, without the `_`-prefixed keys that annotate the file. */
export function parseManifest(json: Record<string, string>): Manifest {
    return new Map(Object.entries(json).filter(([key]) => !key.startsWith("_")));
}

/**
 * Every way `manifest` fails to map each public export of `packages` to
 * exactly one `pitlane/*` subpath. Empty when the manifest is complete.
 */
export function manifestProblems(
    manifest: Manifest,
    packages: Pick<WorkspacePackage, "name" | "exports">[],
): string[] {
    let internal = new Set<string>();
    let exported = new Set<string>();
    for (let { name, exports } of packages) {
        for (let subpath of Object.keys(exports)) {
            let specifier = subpath === "." ? name : `${name}/${subpath.slice(2)}`;
            (INTERNAL.test(subpath) ? internal : exported).add(specifier);
        }
    }

    let problems: string[] = [];
    let owners = new Map<string, string>();
    for (let [path, target] of [...manifest].sort(([a], [b]) => a.localeCompare(b))) {
        if (!path.startsWith("pitlane/")) {
            problems.push(`${path} must start with pitlane/`);
        } else if (internal.has(target)) {
            problems.push(`${path} re-exports ${target}, which is internal`);
        } else if (!exported.has(target)) {
            problems.push(`${path} re-exports ${target}, which no package exports`);
        }

        let owner = owners.get(target);
        if (owner) problems.push(`${owner} and ${path} both re-export ${target}`);
        else owners.set(target, path);
    }

    for (let specifier of exported) {
        if (!owners.has(specifier)) problems.push(`${specifier} has no pitlane/* subpath`);
    }
    return problems;
}
