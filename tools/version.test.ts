import assert from "node:assert/strict";
import test from "node:test";

import { prereleaseVersion, retitleChangelog } from "./version.ts";

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
