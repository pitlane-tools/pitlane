// Checks every commit subject in a pull request range against Scoped Commits.
// The commit-msg hook validates one message as it is written; this validates the
// whole range, because a pull request can carry commits the hook never saw.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let [baseSha, headSha] = process.argv.slice(2);

if (!baseSha || !headSha) {
    console.error("usage: node tools/check-pr-commits.ts <base-sha> <head-sha>");
    process.exit(2);
}

let subjects = execFileSync("git", ["log", "--format=%s", `${baseSha}..${headSha}`], {
    encoding: "utf8",
})
    .split("\n")
    .filter(subject => subject.length > 0);

let directory = mkdtempSync(join(tmpdir(), "commit-subjects-"));
let rejected = 0;

try {
    for (let [index, subject] of subjects.entries()) {
        let messageFile = join(directory, `subject-${index}`);
        writeFileSync(messageFile, `${subject}\n`);
        try {
            execFileSync(process.execPath, ["tools/check-scoped-commit.ts", messageFile], {
                stdio: "inherit",
            });
        } catch {
            // check-scoped-commit already explained the rejection on stderr. Keep going
            // so one run reports every bad subject instead of only the first.
            rejected += 1;
        }
    }
} finally {
    rmSync(directory, { recursive: true, force: true });
}

console.log(`Checked ${subjects.length} commit subject(s); ${rejected} rejected.`);
process.exit(rejected > 0 ? 1 : 0);
