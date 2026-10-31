import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

let statusScript = new URL("./status.ts", import.meta.url).pathname;

// A git hook exports GIT_DIR, GIT_INDEX_FILE and GIT_WORK_TREE, and they point at the
// real repository. Inheriting them would make every fixture `git` call — and the status
// run itself — operate on this checkout instead of the temporary one, so the gate running
// from `pre-push` would rewrite the developer's repository. Strip them.
const ENV = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
);

type Git = (...arguments_: string[]) => string;

function statusWithPullRequests(
    pullRequests: object[],
    context: TestContext,
    options: {
        defaultBranch?: string;
        originHead?: string;
        repoUnavailable?: boolean;
        // Builds history on top of the fixture commit and returns the pull request's head revision.
        history?: (git: Git) => string;
    } = {},
): string {
    let root = mkdtempSync(path.join(tmpdir(), "pitlane-status-"));
    context.after(() => rmSync(root, { force: true, recursive: true }));
    let git: Git = (...arguments_) =>
        execFileSync(
            "git",
            [
                "-C",
                root,
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.com",
                ...arguments_,
            ],
            { encoding: "utf8", env: ENV },
        ).trim();
    execFileSync("git", ["init", "-q", "-b", "feature", root], { env: ENV });
    git("commit", "--allow-empty", "-qm", "fixture");
    if (options.originHead)
        git(
            "symbolic-ref",
            "refs/remotes/origin/HEAD",
            `refs/remotes/origin/${options.originHead}`,
        );
    let headRefOid = options.history ? options.history(git) : git("rev-parse", "HEAD");
    let bin = path.join(root, "bin");
    mkdirSync(bin);
    let gh = path.join(bin, "gh");
    writeFileSync(
        gh,
        [
            `#!${process.execPath}`,
            "let command = process.argv[2];",
            'if (command === "--version" || command === "auth") process.exit(0);',
            'if (command === "repo" && process.env.TEST_REPO_UNAVAILABLE === "1") process.exit(1);',
            'if (command === "repo") console.log(JSON.stringify({defaultBranchRef: {name: process.env.TEST_DEFAULT_BRANCH}, nameWithOwner: "owner/repo"}));',
            'else if (command === "pr" && process.argv[3] === "list") {',
            '  let state = process.argv.indexOf("--state");',
            '  let head = process.argv.indexOf("--head");',
            '  console.log(process.argv[state + 1] === "all" && process.argv[head + 1] === "feature" ? process.env.TEST_PULL_REQUESTS : "[]");',
            "}",
            "else process.exit(1);",
        ].join("\n"),
    );
    chmodSync(gh, 0o755);
    mkdirSync(path.join(root, "proposals"));
    writeFileSync(
        path.join(root, "proposals", "0001-feature.md"),
        "---\nid: proposal.0001\ntitle: Feature\nstatus: implemented\npull-request: 1\n---\n",
    );
    return execFileSync(process.execPath, [statusScript], {
        cwd: root,
        encoding: "utf8",
        env: {
            ...ENV,
            PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
            TEST_PULL_REQUESTS: JSON.stringify(
                pullRequests.map(pullRequest => ({
                    headRefOid,
                    headRepository: { nameWithOwner: "owner/repo" },
                    ...pullRequest,
                })),
            ),
            TEST_DEFAULT_BRANCH: options.defaultBranch ?? "main",
            TEST_REPO_UNAVAILABLE: options.repoUnavailable ? "1" : "0",
        },
    });
}

test("finds an implemented feature's merged PR after it leaves the open PR list", context => {
    let report = statusWithPullRequests(
        [
            {
                number: 1,
                state: "MERGED",
                baseRefName: "main",
                isDraft: false,
                title: "Feature",
                url: "https://github.com/owner/repo/pull/1",
            },
        ],
        context,
    );

    assert.match(report, /PR #1 \(merged\)/);
    assert.match(report, /Phase 5 — Implementation merged/);
    assert.match(report, /confirm.*implemented record.*merged revision/i);
});

test("does not select an arbitrary PR when a branch name has been reused", context => {
    let report = statusWithPullRequests(
        [
            {
                number: 1,
                state: "MERGED",
                baseRefName: "main",
                isDraft: false,
                title: "Earlier",
                url: "https://github.com/owner/repo/pull/1",
            },
            {
                number: 2,
                state: "CLOSED",
                baseRefName: "main",
                isDraft: false,
                title: "Later",
                url: "https://github.com/owner/repo/pull/2",
            },
        ],
        context,
    );

    assert.match(report, /PR — unknown \(Multiple pull requests found for branch feature/);
    assert.doesNotMatch(report, /Implementation merged/);
});

test("rejects a PR record without the URL needed to identify its remote revision", context => {
    let report = statusWithPullRequests(
        [{ number: 1, state: "MERGED", baseRefName: "main", isDraft: false, title: "Feature" }],
        context,
    );

    assert.match(report, /PR — unknown \(gh returned invalid pull request data\)/);
    assert.doesNotMatch(report, /Implementation merged/);
});

test("does not attribute another repository's matching branch name to this checkout", context => {
    let report = statusWithPullRequests(
        [
            {
                number: 1,
                state: "MERGED",
                baseRefName: "main",
                isDraft: false,
                title: "Fork PR",
                url: "https://github.com/owner/repo/pull/1",
                headRepository: { nameWithOwner: "fork/repo" },
            },
        ],
        context,
    );

    assert.match(report, /PR — unknown/);
    assert.doesNotMatch(report, /Implementation merged/);
});

test("does not identify a PR without verifying its repository", context => {
    let report = statusWithPullRequests(
        [
            {
                number: 1,
                state: "MERGED",
                baseRefName: "main",
                isDraft: false,
                title: "Feature",
                url: "https://github.com/owner/repo/pull/1",
            },
        ],
        context,
        { repoUnavailable: true },
    );

    assert.match(report, /PR — unknown/);
    assert.doesNotMatch(report, /Implementation merged/);
});

test("does not use a sole historical PR after the branch has been reused", context => {
    let report = statusWithPullRequests(
        [
            {
                number: 1,
                state: "MERGED",
                baseRefName: "main",
                isDraft: false,
                title: "Old PR",
                url: "https://github.com/owner/repo/pull/1",
                headRefOid: "0000000000000000000000000000000000000000",
            },
        ],
        context,
    );

    assert.match(report, /PR — unknown/);
    assert.doesNotMatch(report, /Implementation merged/);
});

let mergedPullRequest = {
    number: 1,
    state: "MERGED",
    baseRefName: "main",
    isDraft: false,
    title: "Feature",
    url: "https://github.com/owner/repo/pull/1",
};

test("does not call a merged PR implemented when the branch holds commits it never received", context => {
    let report = statusWithPullRequests([mergedPullRequest], context, {
        history: git => {
            let merged = git("rev-parse", "HEAD");
            git("commit", "--allow-empty", "-qm", "record implemented, never pushed");
            return merged;
        },
    });

    assert.match(report, /PR #1 \(merged\)/);
    assert.match(report, /Phase 5 — Merged ahead of the record/);
    assert.doesNotMatch(report, /Implementation merged/);
    assert.match(report, /Warning: .*1 commit.*merged pull request does not contain/);
});

test("does not attribute a merged PR reached only through the default branch's merge commit", context => {
    let report = statusWithPullRequests([mergedPullRequest], context, {
        history: git => {
            git("checkout", "-qb", "earlier");
            git("commit", "--allow-empty", "-qm", "earlier work");
            let merged = git("rev-parse", "HEAD");
            git("checkout", "-q", "feature");
            git("merge", "--no-ff", "-qm", "merge the earlier pull request", "earlier");
            git("commit", "--allow-empty", "-qm", "new work on a reused branch name");
            return merged;
        },
    });

    assert.match(report, /PR — unknown/);
    assert.doesNotMatch(report, /Implementation merged/);
});

test("does not trust an old origin default after GitHub changes the default", context => {
    let report = statusWithPullRequests(
        [
            {
                number: 1,
                state: "MERGED",
                baseRefName: "release/old",
                isDraft: false,
                title: "Feature",
                url: "https://github.com/owner/repo/pull/1",
            },
        ],
        context,
        { originHead: "release/old" },
    );

    assert.doesNotMatch(report, /Phase 5 — Implementation merged/);
    assert.match(report, /main/);
});

test("recognizes a default branch whose name contains a slash", context => {
    let report = statusWithPullRequests(
        [
            {
                number: 1,
                state: "MERGED",
                baseRefName: "release/v1",
                isDraft: false,
                title: "Feature",
                url: "https://github.com/owner/repo/pull/1",
            },
        ],
        context,
        { defaultBranch: "release/v1", originHead: "release/v1" },
    );

    assert.match(report, /Phase 5 — Implementation merged/);
    assert.doesNotMatch(report, /not the default branch/);
});
