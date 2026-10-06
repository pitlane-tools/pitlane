import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { type Manifest, parseManifest } from "./manifest.ts";
import { readWorkspacePackages, type WorkspacePackage } from "./workspace.ts";

export interface InstalledReadme {
    name: string;
    description: string;
    readme: string;
    /** Package-relative destination. */
    path: string;
    /** Every `pitlane/*` subpath re-exporting the package, sorted. */
    exports: string[];
}

/** One README per package `manifest` re-exports, in package order, naming every subpath it documents. */
export function installedReadmes(
    manifest: Manifest,
    packages: Pick<WorkspacePackage, "name" | "directory" | "description">[],
): InstalledReadme[] {
    return packages.flatMap(({ name, directory, description }) => {
        let exports = [...manifest]
            .filter(([, target]) => target === name || target.startsWith(`${name}/`))
            .map(([subpath]) => subpath)
            .sort();
        if (exports.length === 0) return [];
        return [
            {
                name,
                description,
                readme: join(directory, "README.md"),
                path: `dist/${name.slice("@pitlane/".length)}/README.md`,
                exports,
            },
        ];
    });
}

if (import.meta.main) {
    let directory = resolve(import.meta.dirname, "..");
    let manifest = parseManifest(
        JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8")),
    );
    let packages = installedReadmes(manifest, readWorkspacePackages(resolve(directory, "..")));
    execFileSync(
        process.execPath,
        [
            resolve(directory, "../../docs/build/installed.ts"),
            JSON.stringify({ out: directory, packages }),
        ],
        { stdio: "inherit" },
    );
}
