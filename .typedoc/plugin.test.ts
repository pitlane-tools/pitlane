import type { TestContext } from "node:test";
import type { TypeDocOptions } from "typedoc";
import type { PluginOptions } from "typedoc-plugin-markdown";

import fc from "fast-check";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { Application } from "typedoc";

import type { ReferenceEntry } from "./lib/manifest.ts";

let fixture = new URL("./fixtures/reexports/", import.meta.url).pathname;
let entryPoints = ["index", "loaders", "hot"].map(name => path.join(fixture, "src", `${name}.ts`));

function temporaryRoot(t: TestContext): string {
    let root = mkdtempSync(path.join(tmpdir(), "pitlane-typedoc-"));
    t.after(() => rmSync(root, { force: true, recursive: true }));
    return root;
}

// Mirrors one `docs:api` run: `out` is the package's directory under
// docs/app/content/api, from which the generator derives the site root and URL prefix.
async function generate(
    root: string,
    name: string,
    overrides: Partial<TypeDocOptions & PluginOptions> = {},
): Promise<void> {
    let app = await Application.bootstrapWithPlugins({
        options: path.join(fixture, "typedoc.json"),
        out: path.join(root, "docs", "app", "content", "api", name),
        logLevel: "Warn",
        ...overrides,
    });
    let project = await app.convert();
    assert.ok(project, "fixture converts");
    await app.generateOutputs(project);
}

function pages(root: string, name = "pkg"): string[] {
    let packageRoot = path.join(root, "docs", "app", "content", "api", name);
    return readdirSync(packageRoot, { encoding: "utf8", recursive: true })
        .filter(file => file.endsWith(".md"))
        .sort((left, right) => left.localeCompare(right));
}

function read(root: string, page: string, name = "pkg"): string {
    let file = path.join(root, "docs", "app", "content", "api", name, page);
    assert.ok(existsSync(file), `${page} is generated`);
    return readFileSync(file, "utf8");
}

function manifest(root: string): ReferenceEntry[] {
    let file = path.join(root, "docs", ".generated", "reference.json");
    assert.ok(existsSync(file), "docs/.generated/reference.json is generated");
    return JSON.parse(readFileSync(file, "utf8"));
}

function withoutCompatibilityAnchors(markdown: string): string {
    return markdown.replace(/<a id="[^"]*"><\/a>/g, "");
}

test("proposal.0004: every top-level export gets one page at <module>/<kind>/<name>", async t => {
    let root = temporaryRoot(t);
    await generate(root, "pkg");
    assert.deepEqual(pages(root), [
        "class/Widget.md",
        "function/render.md",
        "hot.md",
        "hot/interface/FileEvent.md",
        "hot/interface/Reference.md",
        "index.md",
        "interface/ContentBuilder.md",
        "interface/Reference.md",
        "loaders.md",
        "loaders/function/load.md",
    ]);
});

test("proposal.0004: a declaration re-exported by several modules has one page listing every import path", async t => {
    let root = temporaryRoot(t);
    await generate(root, "pkg");
    let page = read(root, "class/Widget.md");
    assert.match(page, /^import \{ Widget \} from "@fixture\/pkg";$/m);
    assert.match(page, /^import \{ Gadget \} from "@fixture\/pkg\/loaders";$/m);
    assert.match(page, /^import \{ Widget \} from "@fixture\/pkg\/loaders";$/m);
    assert.match(
        read(root, "interface/Reference.md"),
        /^import type \{ Reference \} from "@fixture\/pkg";$/m,
    );
});

test("proposal.0004: a declaration defined by a public module stays there when the root re-exports it", async t => {
    let root = temporaryRoot(t);
    await generate(root, "pkg");
    let page = read(root, "hot/interface/FileEvent.md");
    assert.match(page, /^import type \{ FileEvent \} from "@fixture\/pkg\/hot";$/m);
    assert.match(page, /^import type \{ FileEvent \} from "@fixture\/pkg";$/m);
    assert.match(
        read(root, "index.md"),
        /\[FileEvent\]\(\/package\/pkg\/hot\/interface\/FileEvent\)/,
    );
    let entry = manifest(root).find(page => page.title === "FileEvent");
    assert.equal(entry!.url, "/package/pkg/hot/interface/FileEvent");
    assert.equal(entry!.module, "@fixture/pkg/hot");
    assert.deepEqual(entry!.aliases, [{ module: "@fixture/pkg", name: "FileEvent" }]);
});

test("proposal.0004: module overviews link every export and alias to the canonical page", async t => {
    let root = temporaryRoot(t);
    await generate(root, "pkg");
    assert.match(read(root, "index.md"), /\[Widget\]\(\/package\/pkg\/class\/Widget\)/);
    let loaders = read(root, "loaders.md");
    assert.match(loaders, /^# @fixture\/pkg\/loaders$/m);
    assert.match(loaders, /\[Widget\]\(\/package\/pkg\/class\/Widget\)/);
    assert.match(loaders, /\[Gadget\]\(\/package\/pkg\/class\/Widget\)/);
    assert.match(loaders, /\[load\]\(\/package\/pkg\/loaders\/function\/load\)/);
});

test("proposal.0004: module overviews keep old fragment ids beside the new destination", async t => {
    let root = temporaryRoot(t);
    await generate(root, "pkg");
    let index = read(root, "index.md");
    // The old root page slugged ContentBuilder.reference() first, so the
    // Reference interface historically sat at #reference-1.
    assert.match(
        index,
        /<a id="reference-1"><\/a>[^\n]*\[Reference\]\(\/package\/pkg\/interface\/Reference\)/,
    );
    assert.match(
        index,
        /<a id="reference"><\/a>[^\n]*\[ContentBuilder\]\(\/package\/pkg\/interface\/ContentBuilder\)/,
    );
    assert.match(
        index,
        /<a id="render-1"><\/a>[^\n]*\[render\]\(\/package\/pkg\/function\/render\)/,
    );
    assert.match(index, /<a id="render"><\/a>[^\n]*\[Widget\]\(\/package\/pkg\/class\/Widget\)/);
    assert.match(
        read(root, "loaders.md"),
        /<a id="gadget"><\/a>[^\n]*\[Gadget\]\(\/package\/pkg\/class\/Widget\)/,
    );
    assert.match(
        read(root, "hot.md"),
        /<a id="reference"><\/a>[^\n]*\[Reference\]\(\/package\/pkg\/hot\/interface\/Reference\)/,
    );
});

test("proposal.0004: legacy nested option fragments reach their containing symbol", async t => {
    let root = temporaryRoot(t);
    await generate(root, "pkg");
    let overview = read(root, "loaders.md");
    assert.match(overview, /<a id="loaders"><\/a>/);
    for (let anchor of ["options", "entry", "rules"]) {
        assert.match(
            overview,
            new RegExp(
                `<a id="${anchor}"></a>[^\\n]*\\[load\\]\\(/package/pkg/loaders/function/load\\)`,
            ),
        );
    }
    assert.match(
        read(root, "index.md"),
        /<a id="href"><\/a>[^\n]*\[ContentBuilder\]\(\/package\/pkg\/interface\/ContentBuilder\)/,
    );
});

test("proposal.0004: signatures link to the canonical page of the referenced declaration", async t => {
    let root = temporaryRoot(t);
    await generate(root, "pkg");
    assert.match(
        read(root, "interface/ContentBuilder.md"),
        /\[`Reference`\]\(\/package\/pkg\/interface\/Reference\)/,
    );
    assert.match(
        read(root, "loaders/function/load.md"),
        /\[`Widget`\]\(\/package\/pkg\/class\/Widget\)/,
    );
});

test("proposal.0004: overloads of one function share its page", async t => {
    let root = temporaryRoot(t);
    await generate(root, "pkg");
    let page = read(root, "function/render.md");
    assert.match(page, /^# render$/m);
    assert.match(page, /Renders a value as text\.[\s\S]*Renders a number as text\./);
});

test("proposal.0004: reference.json has one document per canonical page with module, kind, source and aliases", async t => {
    let root = temporaryRoot(t);
    await generate(root, "pkg");
    let entries = manifest(root);
    let urls = entries.map(entry => entry.url);
    assert.equal(new Set(urls).size, urls.length, "canonical document URLs are unique");
    assert.deepEqual(
        entries.filter(entry => entry.kind === "module").map(entry => [entry.url, entry.title]),
        [
            ["/package/pkg/", "@fixture/pkg"],
            ["/package/pkg/hot", "@fixture/pkg/hot"],
            ["/package/pkg/loaders", "@fixture/pkg/loaders"],
        ],
    );
    assert.deepEqual(
        entries
            .filter(entry => entry.title === "Reference")
            .map(entry => [entry.url, entry.module, entry.kind]),
        [
            ["/package/pkg/hot/interface/Reference", "@fixture/pkg/hot", "interface"],
            ["/package/pkg/interface/Reference", "@fixture/pkg", "interface"],
        ],
    );
    assert.equal(
        entries.some(entry => entry.title === "Gadget"),
        false,
        "aliases add no documents",
    );
    let widget = entries.find(entry => entry.url === "/package/pkg/class/Widget");
    assert.equal(widget!.title, "Widget");
    assert.equal(widget!.kind, "class");
    assert.equal(widget!.module, "@fixture/pkg");
    assert.equal(widget!.description, "A widget declared once and exported by two public modules.");
    assert.equal(widget!.sourcePath, "docs/app/content/api/pkg/class/Widget.md");
    assert.ok(
        existsSync(path.join(root, widget!.sourcePath)),
        "sourcePath resolves from the repository root",
    );
    assert.deepEqual(widget!.aliases, [
        { module: "@fixture/pkg/loaders", name: "Gadget" },
        { module: "@fixture/pkg/loaders", name: "Widget" },
    ]);
});

test("proposal.0004: for any entry point order, pages and manifest are identical", async t => {
    let reference = temporaryRoot(t);
    await generate(reference, "pkg");
    let expectedPages = pages(reference);
    let expectedManifest = manifest(reference);
    await fc.assert(
        fc.asyncProperty(
            fc.shuffledSubarray(entryPoints, { minLength: entryPoints.length }),
            async order => {
                let root = temporaryRoot(t);
                await generate(root, "pkg", { entryPoints: order });
                assert.deepEqual(pages(root), expectedPages);
                assert.deepEqual(manifest(root), expectedManifest);
                for (let page of expectedPages) {
                    assert.equal(
                        withoutCompatibilityAnchors(read(root, page)),
                        withoutCompatibilityAnchors(read(reference, page)),
                        page,
                    );
                }
            },
        ),
        { numRuns: 12 },
    );
});

test("proposal.0004: reference.json accumulates packages across runs and drops a package's stale entries", async t => {
    let root = temporaryRoot(t);
    await generate(root, "pkg");
    await generate(root, "other", {
        entryModule: "@fixture/other",
        entryPoints: entryPoints.slice(2),
    });
    let urls = manifest(root).map(page => page.url);
    assert.ok(urls.includes("/package/pkg/class/Widget"));
    assert.deepEqual(
        urls.filter(url => url.startsWith("/package/other")),
        [
            "/package/other/",
            "/package/other/interface/FileEvent",
            "/package/other/interface/Reference",
        ],
    );

    await generate(root, "pkg", { entryPoints: entryPoints.slice(0, 1) });
    urls = manifest(root).map(page => page.url);
    assert.ok(!urls.includes("/package/pkg/loaders"));
    assert.ok(urls.includes("/package/pkg/class/Widget"));
    assert.ok(urls.includes("/package/other/interface/Reference"));
});
