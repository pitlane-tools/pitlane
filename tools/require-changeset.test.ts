import assert from "node:assert/strict";
import { test } from "node:test";

import { changesetFiles } from "./require-changeset.ts";

test("changesetFiles keeps changesets and drops everything else", () => {
    assert.deepEqual(
        changesetFiles([
            ".changeset/brave-moons-shout.md",
            ".changeset/README.md",
            ".changeset/config.json",
            "src/main.ts",
            "docs/.changeset/notes.md",
            "",
        ]),
        [".changeset/brave-moons-shout.md"],
    );
});

test("changesetFiles reports no changesets for an unrelated diff", () => {
    assert.deepEqual(changesetFiles(["README.md", "mise.toml"]), []);
});
