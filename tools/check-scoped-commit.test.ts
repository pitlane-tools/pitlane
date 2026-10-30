import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import {
    allowedScopesFor,
    checkSubject,
    parseScopes,
    scopeOf,
    subjectOf,
} from "./check-scoped-commit.ts";

let projectRoot = path.dirname(import.meta.dirname);
let script = path.join(import.meta.dirname, "check-scoped-commit.ts");

let scopes = new Set(["docs", "tools", "treewide"]);

function temporaryRoot(t: TestContext): string {
    let root = mkdtempSync(path.join(tmpdir(), "workbench-scoped-commit-"));
    t.after(() => rmSync(root, { force: true, recursive: true }));
    return root;
}

function run(t: TestContext, message: string): { code: number; stderr: string } {
    let file = path.join(temporaryRoot(t), "COMMIT_EDITMSG");
    writeFileSync(file, message);
    try {
        execFileSync(process.execPath, [script, file], { encoding: "utf8", stdio: "pipe" });
        return { code: 0, stderr: "" };
    } catch (error) {
        let failure = error as { status: number; stderr: string };
        return { code: failure.status, stderr: failure.stderr };
    }
}

test("subjectOf takes the first line that is neither blank nor a comment", () => {
    assert.equal(subjectOf("docs: add a guide\n"), "docs: add a guide");
    assert.equal(
        subjectOf("\n\n#  a comment\n  docs: add a guide  \n\nbody\n"),
        "docs: add a guide",
    );
    assert.equal(subjectOf("# only comments\n\n"), null);
    assert.equal(subjectOf(""), null);
    assert.equal(subjectOf("docs: add a guide\r\nbody\r\n"), "docs: add a guide");
});

test("scopeOf reads the scope only from a well-formed subject", () => {
    assert.equal(scopeOf("docs: add a guide"), "docs");
    assert.equal(scopeOf("0007-export-queue: reject duplicates"), "0007-export-queue");
    assert.equal(scopeOf("docs:add a guide"), null);
    assert.equal(scopeOf("docs: "), null);
    assert.equal(scopeOf("no colon here"), null);
});

test("parseScopes drops blanks and comments and trims the rest", () => {
    assert.deepEqual(parseScopes("# header\n\n  docs  \ntools\n\n#tail\n"), ["docs", "tools"]);
    assert.deepEqual(parseScopes(""), []);
});

test("checkSubject accepts a configured scope", () => {
    assert.equal(checkSubject("docs: add getting started guide", scopes), null);
});

test("checkSubject rejects a subject with no scope", () => {
    assert.match(String(checkSubject("Added stuff", scopes)), /must be a Scoped Commit/);
});

test("checkSubject rejects Conventional Commits by name", () => {
    assert.match(
        String(checkSubject("feat(api): add thing", scopes)),
        /Conventional Commits 'type\(scope\):' subjects are not allowed/,
    );
    assert.match(String(checkSubject("feat(api)!: add thing", scopes)), /Conventional Commits/);
});

test("checkSubject rejects an unknown scope and names it", () => {
    assert.match(String(checkSubject("nope: do a thing", scopes)), /scope 'nope' is not allowed/);
});

test("checkSubject exempts mechanical subjects", () => {
    for (let subject of [
        "Merge branch main",
        "merge: branch main",
        'Revert "docs: add a guide"',
        "revert: docs: add a guide",
        "fixup! docs: add a guide",
        "squash! docs: add a guide",
    ]) {
        assert.equal(checkSubject(subject, scopes), null, subject);
    }
});

test("checkSubject does not exempt a scope that merely starts with a mechanical word", () => {
    assert.match(
        String(checkSubject("merged: do a thing", scopes)),
        /scope 'merged' is not allowed/,
    );
});

test("allowedScopesFor reads the shipped scope list", () => {
    let allowed = allowedScopesFor(projectRoot, "docs: add getting started guide");
    assert.ok(allowed.has("docs"), "docs is a shipped scope");
    assert.ok(allowed.has("treewide"), "treewide is a shipped scope");
    assert.ok(!allowed.has("# Allowed commit scopes, one per line."), "comments are not scopes");
});

test("allowedScopesFor admits a proposal scope only when that proposal exists", t => {
    let root = temporaryRoot(t);
    let subject = "0007-export-queue: reject duplicates";
    assert.ok(!allowedScopesFor(root, subject).has("0007-export-queue"));

    mkdirSync(path.join(root, "proposals"), { recursive: true });
    writeFileSync(path.join(root, "proposals", "0007-export-queue.md"), "");
    assert.ok(allowedScopesFor(root, subject).has("0007-export-queue"));
});

test("the script accepts a valid subject", t => {
    assert.deepEqual(run(t, "docs: add getting started guide\n"), { code: 0, stderr: "" });
});

test("the script rejects an unscoped subject with a usable message", t => {
    let result = run(t, "Added stuff\n");
    assert.equal(result.code, 1);
    assert.match(result.stderr, /check-scoped-commit: subject must be a Scoped Commit/);
});

test("the script accepts a message that is only comments", t => {
    assert.equal(run(t, "# nothing here\n\n").code, 0);
});

test("the script fails when its argument is missing or unreadable", t => {
    let missing = path.join(temporaryRoot(t), "absent");
    try {
        execFileSync(process.execPath, [script, missing], { encoding: "utf8", stdio: "pipe" });
        assert.fail("expected a failure for an unreadable message file");
    } catch (error) {
        let failure = error as { status: number; stderr: string };
        assert.equal(failure.status, 1);
        assert.match(failure.stderr, /cannot read the commit-message file/);
    }

    try {
        execFileSync(process.execPath, [script], { encoding: "utf8", stdio: "pipe" });
        assert.fail("expected a failure for a missing argument");
    } catch (error) {
        let failure = error as { status: number; stderr: string };
        assert.equal(failure.status, 1);
        assert.match(failure.stderr, /usage: node tools\/check-scoped-commit\.ts/);
    }
});
