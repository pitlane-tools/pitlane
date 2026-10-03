import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { manifestProblems, parseManifest } from "./manifest.ts";
import { type ExportShape, exportShape, liftPeers, stubSource } from "./umbrella.ts";
import { readWorkspacePackages, type WorkspacePackage } from "./workspace.ts";

/** Everything the generator owns: the files under `src/` and four `package.json` fields. */
export interface Umbrella {
    /** Each generated file's contents, by path relative to the package. */
    files: Map<string, string>;
    fields: {
        exports: Record<string, Record<string, string>>;
        dependencies: Record<string, string>;
        peerDependencies: Record<string, string>;
        peerDependenciesMeta: Record<string, { optional: true }>;
    };
}

/** The generated umbrella for the package in `directory`, from its `manifest.json`. */
export function generateUmbrella(directory: string): Umbrella {
    let manifest = parseManifest(
        JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8")),
    );
    let packages = readWorkspacePackages(resolve(directory, ".."));
    let problems = manifestProblems(manifest, packages);
    if (problems.length > 0) {
        throw new Error(
            `manifest.json is out of step with the packages:\n- ${problems.join("\n- ")}`,
        );
    }

    let files = new Map<string, string>();
    let exports: Umbrella["fields"]["exports"] = {};
    let used = new Set<WorkspacePackage>();

    for (let [path, target] of [...manifest].sort(([a], [b]) => a.localeCompare(b))) {
        let owner = packages.find(({ name }) => target === name || target.startsWith(`${name}/`))!;
        used.add(owner);
        let shape = targetShape(owner, target);
        let subpath = path.slice("pitlane/".length);

        if (shape.kind === "ambient") {
            files.set(`src/${subpath}.d.ts`, stubSource(target, shape));
            exports[`./${subpath}`] = { types: `./dist/${subpath}.d.ts` };
        } else {
            files.set(`src/${subpath}.ts`, stubSource(target, shape));
            exports[`./${subpath}`] = {
                types: `./dist/${subpath}.d.mts`,
                import: `./dist/${subpath}.mjs`,
            };
        }
    }

    // Exact pins: each release of `pitlane` names one set of package versions,
    // and any package release leaves the umbrella out of range, so Changesets
    // releases it too.
    let dependencies = Object.fromEntries([...used].map(({ name }) => [name, "workspace:*"]));
    return { files, fields: { exports, dependencies, ...liftPeers([...used]) } };
}

/**
 * The shape of the module `target` names, read from its source. Packages
 * build `src/<name>.ts` to `dist/<name>.mjs`, and ship a declaration-only
 * `src/<name>.d.ts` as `dist/<name>.d.mts`.
 */
function targetShape(owner: WorkspacePackage, target: string): ExportShape {
    let subpath = target === owner.name ? "." : `./${target.slice(owner.name.length + 1)}`;
    let conditions = owner.exports[subpath]!;
    let built = conditions.import ?? conditions.types;
    let source = built
        ?.replace(/^\.\/dist\//, "src/")
        .replace(/\.mjs$/, ".ts")
        .replace(/\.d\.mts$/, ".d.ts");
    if (!source?.startsWith("src/")) {
        throw new Error(`${target}: cannot find the source of ${String(built)}`);
    }
    return exportShape(readFileSync(join(owner.directory, source), "utf8"), source);
}

/** Replaces `src/` and the generated `package.json` fields with `umbrella`. */
export function writeUmbrella(directory: string, umbrella: Umbrella): void {
    rmSync(join(directory, "src"), { recursive: true, force: true });
    for (let [path, contents] of umbrella.files) {
        mkdirSync(dirname(join(directory, path)), { recursive: true });
        writeFileSync(join(directory, path), contents);
    }

    let manifestPath = join(directory, "package.json");
    let manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    writeFileSync(
        manifestPath,
        `${JSON.stringify({ ...manifest, ...umbrella.fields }, null, 4)}\n`,
    );
}

if (import.meta.main) {
    let directory = resolve(import.meta.dirname, "..");
    writeUmbrella(directory, generateUmbrella(directory));
}
