import {
    LEDGER,
    publishedPackages,
    readLedger,
    thirdPartyDependencies,
} from "./support/packages.ts";

/** policy.0008: the ledger justifies every third-party dependency of a published package, and nothing else. */
export function check(root: string): string[] {
    let ledger = readLedger(root);
    if (!ledger) {
        return [
            `${LEDGER}: missing; record a reason for every third-party dependency of a published package (policy.0008)`,
        ];
    }

    let violations: string[] = [];
    let published = new Map(publishedPackages(root).map(pkg => [pkg.manifest.name, pkg]));

    for (let [name, { manifest, directory }] of published) {
        let entries = ledger[name] ?? {};
        let dependencies = thirdPartyDependencies(manifest);
        for (let dependency of dependencies) {
            if (!(dependency in entries)) {
                violations.push(
                    `${directory}/package.json: "${dependency}" has no entry under "${name}" in ${LEDGER}; say why Pitlane depends on it rather than vendoring or reimplementing it (policy.0008)`,
                );
            }
        }
        for (let [dependency, entry] of Object.entries(entries)) {
            if (!dependencies.includes(dependency)) {
                violations.push(
                    `${LEDGER}: "${name}" does not depend on "${dependency}"; remove the stale entry (policy.0008)`,
                );
                continue;
            }
            if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
                violations.push(
                    `${LEDGER}: "${name}" → "${dependency}" has no reason; say why Pitlane depends on it rather than vendoring or reimplementing it (policy.0008)`,
                );
            }
            if (typeof entry.publicTypes !== "boolean") {
                violations.push(
                    `${LEDGER}: "${name}" → "${dependency}" needs publicTypes set to true or false (policy.0008)`,
                );
            }
        }
    }

    for (let name of Object.keys(ledger)) {
        if (!published.has(name)) {
            violations.push(
                `${LEDGER}: "${name}" is not a published package; remove its stale section (policy.0008)`,
            );
        }
    }
    return violations;
}
