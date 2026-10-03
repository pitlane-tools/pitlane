/**
 * Prepares versions: runs `changeset version`, then keeps every package named
 * in `.changeset/prerelease.json` on its prerelease channel.
 *
 * Changesets' own prerelease mode applies to the whole workspace at once, and
 * outside it a patch to `1.0.0-alpha.1` computes `1.0.0`: the next dependency
 * update of a prerelease package would publish its stable release by accident.
 * A package listed as `{ "pitlane": "alpha" }` instead advances `alpha.N`, and
 * removing it from the file ends the prerelease at the version Changesets
 * computes next.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHANNELS = ".changeset/prerelease.json";
const PRERELEASE = /^(\d+\.\d+\.\d+)-([a-z]+)\.(\d+)$/;

/** The version a package on `channel` releases as, given what Changesets computed. */
export function prereleaseVersion(before: string, computed: string, channel: string): string {
    let current = before.match(PRERELEASE);
    if (current && current[2] === channel) {
        return `${current[1]}-${channel}.${Number(current[3]) + 1}`;
    }
    return `${computed.replace(/-.*$/, "")}-${channel}.1`;
}

/** `changelog` with the section Changesets wrote for `computed` headed `version` instead. */
export function retitleChangelog(changelog: string, computed: string, version: string): string {
    let heading = `\n## ${computed}\n`;
    if (!changelog.includes(heading)) {
        throw new Error(`The changelog has no "## ${computed}" section to retitle.`);
    }
    return changelog.replace(heading, `\n## ${version}\n`);
}

interface Workspace {
    directory: string;
    manifest: { name: string; version: string } & Record<string, unknown>;
}

function readWorkspace(): Workspace[] {
    return readdirSync("packages", { withFileTypes: true })
        .map(entry => join("packages", entry.name))
        .filter(directory => existsSync(join(directory, "package.json")))
        .map(directory => ({
            directory,
            manifest: JSON.parse(readFileSync(join(directory, "package.json"), "utf8")),
        }));
}

function main() {
    let channels: Record<string, string> = existsSync(CHANNELS)
        ? JSON.parse(readFileSync(CHANNELS, "utf8"))
        : {};
    let workspace = readWorkspace();
    // Changesets writes a dependent's range from the version it computed, which
    // this script then replaces, so a channel only fits a package nothing depends on.
    for (let { manifest } of workspace) {
        let dependencies = Object.keys({
            ...(manifest.dependencies as object),
            ...(manifest.peerDependencies as object),
        });
        let pinned = dependencies.find(name => channels[name]);
        if (pinned) {
            throw new Error(
                `${manifest.name} depends on ${pinned}, which ${CHANNELS} keeps on a channel.`,
            );
        }
    }
    let before = new Map(workspace.map(({ manifest }) => [manifest.name, manifest.version]));

    execFileSync("changeset", ["version"], { stdio: "inherit" });

    for (let { directory, manifest } of readWorkspace()) {
        let channel = channels[manifest.name];
        let previous = before.get(manifest.name);
        if (!channel || !previous || manifest.version === previous) continue;

        let computed = manifest.version;
        let version = prereleaseVersion(previous, computed, channel);
        writeFileSync(
            join(directory, "package.json"),
            `${JSON.stringify({ ...manifest, version }, null, 4)}\n`,
        );
        let changelog = join(directory, "CHANGELOG.md");
        writeFileSync(
            changelog,
            retitleChangelog(readFileSync(changelog, "utf8"), computed, version),
        );
        console.log(`${manifest.name}: ${computed} → ${version} (${channel})`);
    }
}

if (import.meta.main) main();
