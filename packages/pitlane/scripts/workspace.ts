import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** What the umbrella reads from a published `@pitlane/*` package's manifest. */
export interface WorkspacePackage {
    name: string;
    directory: string;
    exports: Record<string, Record<string, string>>;
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

/** Every `@pitlane/*` package under `packagesDirectory` that is published. */
export function readWorkspacePackages(packagesDirectory: string): WorkspacePackage[] {
    return readdirSync(packagesDirectory, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => join(packagesDirectory, entry.name))
        .filter(directory => existsSync(join(directory, "package.json")))
        .map(directory => ({
            directory,
            manifest: JSON.parse(readFileSync(join(directory, "package.json"), "utf8")),
        }))
        .filter(({ manifest }) => manifest.name?.startsWith("@pitlane/") && !manifest.private)
        .map(({ directory, manifest }) => ({
            name: manifest.name,
            directory,
            exports: manifest.exports ?? {},
            peerDependencies: manifest.peerDependencies,
            peerDependenciesMeta: manifest.peerDependenciesMeta,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
