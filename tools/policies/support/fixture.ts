import type { TestContext } from "node:test";

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** A repository in a temporary directory, holding `files` and removed after the test. */
export function fixture(t: TestContext, files: Record<string, string | object>): string {
    let root = mkdtempSync(join(tmpdir(), "pitlane-policies-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    for (let [path, content] of Object.entries(files)) {
        let file = join(root, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
    }
    return root;
}
