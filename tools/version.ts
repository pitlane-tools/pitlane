/**
 * Prepares versions: runs `changeset version`, then applies the two release
 * rules in `.changeset/release.json` that Changesets cannot express.
 *
 * `manual` packages release only when a pending note names them. The umbrella
 * pins every package exactly, so Changesets bumps it whenever any of them
 * changes; this puts it back unless a note asked for a release, and lists the
 * versions it pins in the section of a release that was asked for.
 *
 * `prerelease` keeps a package on a channel. Changesets' own prerelease mode
 * applies to the whole workspace at once, and outside it a patch to
 * `1.0.0-alpha.1` computes `1.0.0`. A package listed as `{ "pitlane": "alpha" }`
 * advances `alpha.N` instead; removing it ends the prerelease at the version
 * Changesets computes next.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SETTINGS = ".changeset/release.json";
const PRERELEASE = /^(\d+\.\d+\.\d+)-([a-z]+)\.(\d+)$/;

interface Settings {
    manual: string[];
    prerelease: Record<string, string>;
}

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

/** Every package the frontmatter of a pending note names. */
export function notedPackages(notes: string[]): Set<string> {
    let names = notes.flatMap(note => {
        let frontmatter = note.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
        return [...frontmatter.matchAll(/^\s*["']?([^"':\s]+)["']?\s*:/gm)].map(match => match[1]!);
    });
    return new Set(names);
}

/** `changelog` with the package versions `version` pins listed at the end of its section. */
export function listPins(changelog: string, version: string, pins: string[]): string {
    let heading = `\n## ${version}\n`;
    let start = changelog.indexOf(heading);
    if (start === -1) throw new Error(`The changelog has no "## ${version}" section.`);
    let next = changelog.indexOf("\n## ", start + heading.length);
    let end = next === -1 ? changelog.length : next;
    let list = pins.map(pin => `- \`${pin}\``).join("\n");
    return `${changelog.slice(0, end).trimEnd()}\n\n### Pinned packages\n\n${list}\n${changelog.slice(end)}`;
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

function readNotes(): string[] {
    return readdirSync(".changeset")
        .filter(name => name.endsWith(".md") && name !== "README.md")
        .map(name => readFileSync(join(".changeset", name), "utf8"));
}

function readText(path: string): string | undefined {
    return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

/**
 * Changesets writes a dependent's range from the version it computed, which
 * this script may then replace or undo, so both rules fit only a package
 * nothing else in the workspace depends on.
 */
function assertNoDependents(workspace: Workspace[], settings: Settings) {
    let ruled = new Set([...settings.manual, ...Object.keys(settings.prerelease)]);
    for (let { manifest } of workspace) {
        let dependencies = Object.keys({
            ...(manifest.dependencies as object),
            ...(manifest.peerDependencies as object),
        });
        let ruledDependency = dependencies.find(name => ruled.has(name));
        if (ruledDependency) {
            throw new Error(
                `${manifest.name} depends on ${ruledDependency}, which ${SETTINGS} gives a release rule.`,
            );
        }
    }
}

function main() {
    let settings: Settings = {
        manual: [],
        prerelease: {},
        ...JSON.parse(readFileSync(SETTINGS, "utf8")),
    };
    let workspace = readWorkspace();
    assertNoDependents(workspace, settings);

    let noted = notedPackages(readNotes());
    let held = workspace
        .filter(
            ({ manifest }) => settings.manual.includes(manifest.name) && !noted.has(manifest.name),
        )
        .flatMap(({ directory }) =>
            ["package.json", "CHANGELOG.md"].map(file => {
                let path = join(directory, file);
                return { path, text: readText(path) };
            }),
        );
    let before = new Map(workspace.map(({ manifest }) => [manifest.name, manifest.version]));

    execFileSync("changeset", ["version"], { stdio: "inherit" });

    for (let { path, text } of held) {
        if (text !== undefined) writeFileSync(path, text);
    }
    let after = readWorkspace();
    let versions = new Map(after.map(({ manifest }) => [manifest.name, manifest.version]));

    for (let { directory, manifest } of after) {
        let channel = settings.prerelease[manifest.name];
        let manual = settings.manual.includes(manifest.name);
        let previous = before.get(manifest.name);
        if (!(channel || manual) || !previous || manifest.version === previous) continue;

        let computed = manifest.version;
        let version = channel ? prereleaseVersion(previous, computed, channel) : computed;
        let changelogPath = join(directory, "CHANGELOG.md");
        let changelog = retitleChangelog(readFileSync(changelogPath, "utf8"), computed, version);
        if (manual) {
            let pins = Object.entries((manifest.dependencies ?? {}) as Record<string, string>)
                .filter(([, range]) => range.startsWith("workspace:"))
                .map(([name]) => `${name}@${versions.get(name)}`);
            changelog = listPins(changelog, version, pins);
        }
        writeFileSync(changelogPath, changelog);
        writeFileSync(
            join(directory, "package.json"),
            `${JSON.stringify({ ...manifest, version }, null, 4)}\n`,
        );
        if (version !== computed)
            console.log(`${manifest.name}: ${computed} → ${version} (${channel})`);
    }
}

if (import.meta.main) main();
