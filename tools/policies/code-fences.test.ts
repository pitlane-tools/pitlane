import type { TestContext } from "node:test";

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { check } from "./code-fences.ts";

function temporaryRoot(t: TestContext) {
    let root = mkdtempSync(path.join(tmpdir(), "policy-code-fences-"));
    t.after(() => rmSync(root, { force: true, recursive: true }));
    return root;
}

function writeFile(root: string, relativePath: string, content: string) {
    let file = path.join(root, relativePath);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
}

function writePackage(root: string, directory: string, manifest: object, readme: string) {
    writeFile(root, `packages/${directory}/package.json`, JSON.stringify(manifest));
    writeFile(root, `packages/${directory}/README.md`, readme);
}

let unlabeled = ["# Title", "", "```", "pnpm add pitlane", "```", ""].join("\n");

test("reports an unlabeled fence at its opening line", t => {
    let root = temporaryRoot(t);
    writeFile(root, "docs/app/content/guides/start.md", unlabeled);

    assert.deepEqual(check(root), [
        "docs/app/content/guides/start.md:3: fenced code block declares no language; name one after the opening fence, such as ```ts or ```sh (policy.0004)",
    ]);
});

test("accepts fences that declare a language, with or without meta", t => {
    let root = temporaryRoot(t);
    writeFile(
        root,
        "docs/app/content/guides/start.mdx",
        [
            "```ts",
            "let a = 1;",
            "```",
            "",
            '~~~sh title="install"',
            "pnpm add pitlane",
            "~~~",
            "",
        ].join("\n"),
    );

    assert.deepEqual(check(root), []);
});

test("reports an unlabeled fence indented inside an MDX component", t => {
    let root = temporaryRoot(t);
    writeFile(
        root,
        "docs/app/content/_partials/install.mdx",
        [
            "<Tabs>",
            '  <Tab label="pnpm">',
            "    ~~~",
            "    pnpm add pitlane",
            "    ~~~",
            "  </Tab>",
            "</Tabs>",
            "",
        ].join("\n"),
    );

    assert.deepEqual(check(root), [
        "docs/app/content/_partials/install.mdx:3: fenced code block declares no language; name one after the opening fence, such as ```ts or ```sh (policy.0004)",
    ]);
});

test("treats a shorter fence inside a longer one as content", t => {
    let root = temporaryRoot(t);
    writeFile(
        root,
        "docs/app/content/deployment/cloudflare.md",
        ["````md", "```", "inner", "```", "````", "", "```", "outer", "```", ""].join("\n"),
    );

    assert.deepEqual(check(root), [
        "docs/app/content/deployment/cloudflare.md:7: fenced code block declares no language; name one after the opening fence, such as ```ts or ```sh (policy.0004)",
    ]);
});

test("does not close a fence on a different fence character", t => {
    let root = temporaryRoot(t);
    writeFile(root, "docs/app/content/guides/start.md", ["~~~md", "```", "~~~", ""].join("\n"));

    assert.deepEqual(check(root), []);
});

test("scans published package READMEs and the umbrella README, not private ones", t => {
    let root = temporaryRoot(t);
    writePackage(root, "content", { name: "@pitlane/content" }, unlabeled);
    writePackage(root, "pitlane", { name: "pitlane" }, unlabeled);
    writePackage(root, "mdx-checker", { name: "@pitlane/mdx-checker", private: true }, unlabeled);
    writePackage(root, "create-pitlane", { name: "create-pitlane" }, unlabeled);

    assert.deepEqual(check(root), [
        "packages/content/README.md:3: fenced code block declares no language; name one after the opening fence, such as ```ts or ```sh (policy.0004)",
        "packages/pitlane/README.md:3: fenced code block declares no language; name one after the opening fence, such as ```ts or ```sh (policy.0004)",
    ]);
});

test("ignores docs outside the app-facing content directories", t => {
    let root = temporaryRoot(t);
    writeFile(root, "docs/internal/notes.md", unlabeled);
    writeFile(root, "docs/app/content/api/content/index.md", unlabeled);

    assert.deepEqual(check(root), []);
});
