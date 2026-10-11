import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { publishedPackages } from "./support/packages.ts";

/** policy.0011: each published package's README installs it and imports it under its own name. */
export function check(root: string): string[] {
    let violations: string[] = [];
    for (let { manifest, directory } of publishedPackages(root)) {
        let file = `${directory}/README.md`;
        if (!existsSync(join(root, file))) {
            violations.push(
                `${file}: missing; every published package needs a README that installs and imports it (policy.0011)`,
            );
            continue;
        }
        let readme = readFileSync(join(root, file), "utf8");
        let name = manifest.name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
        let install = new RegExp(
            `(\\b(npm (i|install)|pnpm add|yarn add|bun add|vp add)\\b[^\\n]*|<InstallGroup\\b[^>]*)["'\`\\s]${name}(?![\\w/.-])`,
        );
        let usage = new RegExp(`\\b(from|import)\\s*\\(?\\s*["']${name}(/[^"']*)?["']`);
        if (!install.test(readme)) {
            violations.push(
                `${file}: no install command for ${manifest.name}; add one, such as \`npm install ${manifest.name}\` (policy.0011)`,
            );
        }
        if (!usage.test(readme)) {
            violations.push(
                `${file}: no import from ${manifest.name} or its subpaths; show one, so the README stands on its own (policy.0011)`,
            );
        }
    }
    return violations;
}
