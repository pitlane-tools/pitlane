import type { TestContext } from "node:test";

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { check } from "./import-style.ts";

function temporaryRoot(t: TestContext) {
    let root = mkdtempSync(path.join(tmpdir(), "policy-import-style-"));
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

function fenced(...code: string[]) {
    return ["# Title", "", "```ts", ...code, "```", ""].join("\n");
}

test("reports a guide that imports a scoped package", t => {
    let root = temporaryRoot(t);
    writeFile(
        root,
        "docs/app/content/guides/content.md",
        fenced('import { load } from "@pitlane/content/loader";'),
    );

    assert.deepEqual(check(root), [
        'docs/app/content/guides/content.md:4: guide imports "@pitlane/content/loader"; app-facing guides import through the umbrella as "pitlane/content/loader", or mark a deliberate scoped import with <!-- policy.0014: scoped package --> before the fence (policy.0014)',
    ]);
});

test("exempts a guide fence marked as a deliberate scoped import", t => {
    let root = temporaryRoot(t);
    let scoped = ["```ts", 'import { crawl } from "@pitlane/crawler";', "```"];
    writeFile(
        root,
        "docs/app/content/guides/crawler.md",
        ["Without a bundler:", "", "<!-- policy.0014: scoped package -->", "", ...scoped, ""].join(
            "\n",
        ),
    );
    writeFile(
        root,
        "docs/app/content/_partials/crawler.mdx",
        [
            "<NoBuild>",
            "  {/* policy.0014: scoped package */}",
            "  ```ts",
            '  import { crawl } from "@pitlane/crawler";',
            "  ```",
            "</NoBuild>",
            "",
        ].join("\n"),
    );

    assert.deepEqual(check(root), []);
});

test("exempts only the fence directly after the marker", t => {
    let root = temporaryRoot(t);
    let scoped = ["```ts", 'import { crawl } from "@pitlane/crawler";', "```"];
    writeFile(
        root,
        "docs/app/content/guides/crawler.md",
        [
            "<!-- policy.0014: scoped package -->",
            "",
            "Prose between them.",
            "",
            ...scoped,
            "",
            "<!-- policy.0014: scoped package -->",
            ...scoped,
            ...scoped,
            "",
        ].join("\n"),
    );

    assert.deepEqual(
        check(root).map(violation => violation.split(":").slice(0, 2).join(":")),
        ["docs/app/content/guides/crawler.md:6", "docs/app/content/guides/crawler.md:14"],
    );
});

test("accepts the marker only in the comment syntax valid for the file type", t => {
    let root = temporaryRoot(t);
    let scoped = ["```ts", 'import { crawl } from "@pitlane/crawler";', "```", ""];
    writeFile(
        root,
        "docs/app/content/guides/crawler.md",
        ["{/* policy.0014: scoped package */}", ...scoped].join("\n"),
    );
    writeFile(
        root,
        "docs/app/content/guides/crawler.mdx",
        ["<!-- policy.0014: scoped package -->", ...scoped].join("\n"),
    );

    assert.deepEqual(check(root), [
        'docs/app/content/guides/crawler.md:3: guide imports "@pitlane/crawler"; app-facing guides import through the umbrella as "pitlane/crawler", or mark a deliberate scoped import with <!-- policy.0014: scoped package --> before the fence (policy.0014)',
        'docs/app/content/guides/crawler.mdx:3: guide imports "@pitlane/crawler"; app-facing guides import through the umbrella as "pitlane/crawler", or mark a deliberate scoped import with {/* policy.0014: scoped package */} before the fence (policy.0014)',
    ]);
});

test("reports a package README that imports through the umbrella", t => {
    let root = temporaryRoot(t);
    writePackage(
        root,
        "theme",
        { name: "@pitlane/theme" },
        fenced('import "pitlane/theme/styles.css";'),
    );

    assert.deepEqual(check(root), [
        'packages/theme/README.md:4: README imports "pitlane/theme/styles.css"; package READMEs import the package directly as "@pitlane/theme/styles.css" (policy.0014)',
    ]);
});

test("finds every import form inside code", t => {
    let root = temporaryRoot(t);
    writeFile(
        root,
        "docs/app/content/deployment/workers.mdx",
        fenced(
            'import "@pitlane/theme";',
            'let crawler = await import("@pitlane/crawler");',
            'export { remix } from "@pitlane/vite-plugin-remix";',
            "import {",
            "    fetchServer,",
            "} from '@pitlane/vite-plugin-fetch-server';",
        ),
    );

    assert.deepEqual(
        check(root).map(violation => violation.split(":").slice(0, 2).join(":")),
        [4, 5, 6, 9].map(line => `docs/app/content/deployment/workers.mdx:${line}`),
    );
});

test("accepts the import style each audience expects", t => {
    let root = temporaryRoot(t);
    writeFile(
        root,
        "docs/app/content/_partials/setup.mdx",
        fenced('import { remix } from "pitlane/vite-plugin-remix";'),
    );
    writePackage(
        root,
        "content",
        { name: "@pitlane/content" },
        fenced('import { load } from "@pitlane/content";'),
    );

    assert.deepEqual(check(root), []);
});

test("ignores prose mentions outside fenced code", t => {
    let root = temporaryRoot(t);
    writeFile(
        root,
        "docs/app/content/guides/install.md",
        'Install `@pitlane/content` directly, or write `import "@pitlane/content"` if you prefer.\n',
    );
    writePackage(
        root,
        "content",
        { name: "@pitlane/content" },
        'The umbrella re-exports this as `from "pitlane/content"`.\n',
    );

    assert.deepEqual(check(root), []);
});

test("skips the umbrella, private, and unscoped package READMEs", t => {
    let root = temporaryRoot(t);
    let umbrellaImport = fenced('import { load } from "pitlane/content";');
    writePackage(root, "pitlane", { name: "pitlane" }, umbrellaImport);
    writePackage(
        root,
        "mdx-checker",
        { name: "@pitlane/mdx-checker", private: true },
        umbrellaImport,
    );
    writePackage(root, "create-pitlane", { name: "create-pitlane" }, umbrellaImport);

    assert.deepEqual(check(root), []);
});
