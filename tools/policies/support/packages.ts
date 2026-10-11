import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Manifest {
    name: string;
    private?: boolean;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
}

export interface PublishedPackage {
    manifest: Manifest;
    /** Repo-relative, such as `packages/assets`. */
    directory: string;
}

export interface LedgerEntry {
    reason: unknown;
    publicTypes: unknown;
}

export type Ledger = Record<string, Record<string, LedgerEntry>>;

export const LEDGER = ".agents/dependencies.json";

/** Whether a workspace is published as `@pitlane/<name>`; the unscoped umbrella and private ones are not. */
export function isPublished(manifest: Manifest): boolean {
    return manifest.name.startsWith("@pitlane/") && !manifest.private;
}

/** Every `packages/*` workspace that {@link isPublished}. */
export function publishedPackages(root: string): PublishedPackage[] {
    let packages: PublishedPackage[] = [];
    for (let name of readdirSync(join(root, "packages")).sort()) {
        let file = join(root, "packages", name, "package.json");
        if (!existsSync(file)) continue;
        let manifest = JSON.parse(readFileSync(file, "utf8")) as Manifest;
        if (!isPublished(manifest)) continue;
        packages.push({ manifest, directory: `packages/${name}` });
    }
    return packages;
}

/** Runtime dependencies a consumer installs with the package, other than Remix and Pitlane's own. */
export function thirdPartyDependencies(manifest: Manifest): string[] {
    let names = new Set([
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
        ...Object.keys(manifest.optionalDependencies ?? {}),
    ]);
    return [...names].filter(name => name !== "remix" && !name.startsWith("@pitlane/")).sort();
}

export function readLedger(root: string): Ledger | undefined {
    let file = join(root, LEDGER);
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Ledger) : undefined;
}
