import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { moduleSpecifiers } from "./support/module-specifiers.ts";
import { publishedPackages, readLedger } from "./support/packages.ts";

/** policy.0010: built declarations name no third-party module the ledger does not allow. */
export function check(root: string): string[] {
    let ledger = readLedger(root) ?? {};
    let violations: string[] = [];
    for (let { manifest, directory } of publishedPackages(root)) {
        let files = declarationFiles(join(root, directory, "dist"));
        if (files.length === 0) {
            violations.push(
                `${directory}/dist: no built declarations to check; run \`vp run build\` in ${directory} first (policy.0010)`,
            );
            continue;
        }
        let allowed = new Set([manifest.name, "remix"]);
        for (let [dependency, entry] of Object.entries(ledger[manifest.name] ?? {})) {
            if (entry.publicTypes === true) allowed.add(dependency);
        }
        for (let file of files) {
            let source = readFileSync(join(root, directory, "dist", file), "utf8");
            for (let { specifier, line } of moduleSpecifiers(source)) {
                if (isAllowed(specifier, allowed)) continue;
                violations.push(
                    `${directory}/dist/${file}:${line}: names "${specifier}", whose types the ledger does not allow in public declarations; replace it with a Pitlane-owned type (policy.0010)`,
                );
            }
        }
    }
    return violations;
}

function isAllowed(specifier: string, allowed: Set<string>): boolean {
    // Relative paths are the package's own chunks; schemes such as `node:`
    // and `cloudflare:` name runtime built-ins and provider runtimes.
    if (specifier.startsWith(".") || /^[a-z][a-z\d+.-]*:/.test(specifier)) return true;
    if (specifier.startsWith("@pitlane/")) return true;
    let segments = specifier.split("/");
    let packageName = specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
    return allowed.has(packageName);
}

function declarationFiles(dist: string): string[] {
    if (!existsSync(dist)) return [];
    return readdirSync(dist, { recursive: true, encoding: "utf8" })
        .filter(file => file.endsWith(".d.mts") || file.endsWith(".d.ts"))
        .sort();
}
