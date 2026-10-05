import assert from "node:assert/strict";
import test from "node:test";

import { listPins, notedPackages, prereleaseVersion, retitleChangelog } from "./version.ts";

test("a package entering a channel takes the computed version as the first prerelease of it", () => {
    assert.equal(prereleaseVersion("0.0.1", "1.0.0", "alpha"), "1.0.0-alpha.1");
});

test("a package already on the channel advances its prerelease number, whatever the bump", () => {
    // From 1.0.0-alpha.1 Changesets computes 1.0.0 for a patch, which would
    // publish the stable release by accident.
    assert.equal(prereleaseVersion("1.0.0-alpha.1", "1.0.0", "alpha"), "1.0.0-alpha.2");
    assert.equal(prereleaseVersion("1.0.0-alpha.9", "1.0.0", "alpha"), "1.0.0-alpha.10");
});

test("a package moving to another channel starts that channel at 1", () => {
    assert.equal(prereleaseVersion("1.0.0-alpha.4", "1.0.0", "beta"), "1.0.0-beta.1");
});

test("the changelog section Changesets wrote takes the prerelease version as its heading", () => {
    let changelog =
        "# pitlane\n\n## 1.0.0\n\n### Major Changes\n\n- Ship it.\n\n## 0.0.1\n\nOlder.\n";
    assert.equal(
        retitleChangelog(changelog, "1.0.0", "1.0.0-alpha.1"),
        "# pitlane\n\n## 1.0.0-alpha.1\n\n### Major Changes\n\n- Ship it.\n\n## 0.0.1\n\nOlder.\n",
    );
});

test("a changelog without the section Changesets should have written is an error", () => {
    assert.throws(
        () => retitleChangelog("# pitlane\n\n## 0.0.1\n", "1.0.0", "1.0.0-alpha.1"),
        /no "## 1\.0\.0" section/,
    );
});

test("a note names every package in its frontmatter, quoted or not, and nothing in its body", () => {
    let notes = [
        '---\n"@pitlane/dev": patch\npitlane: minor\n---\n\nmentions "@pitlane/theme": in prose\n',
        "---\n'@pitlane/content': major\n---\n\nbody\n",
    ];
    assert.deepEqual([...notedPackages(notes)].sort(), [
        "@pitlane/content",
        "@pitlane/dev",
        "pitlane",
    ]);
});

test("a manual release lists the versions it pins at the end of its own section", () => {
    let changelog =
        "# pitlane\n\n## 1.0.0-alpha.2\n\n### Minor Changes\n\n- More.\n\n## 1.0.0-alpha.1\n\nOlder.\n";
    assert.equal(
        listPins(changelog, "1.0.0-alpha.2", ["@pitlane/content@0.3.1", "@pitlane/dev@0.7.1"]),
        "# pitlane\n\n## 1.0.0-alpha.2\n\n### Minor Changes\n\n- More.\n\n### Pinned packages\n\n" +
            "- `@pitlane/content@0.3.1`\n- `@pitlane/dev@0.7.1`\n\n## 1.0.0-alpha.1\n\nOlder.\n",
    );
});
