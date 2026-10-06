import fc from "fast-check";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import test from "node:test";
import { markdownToMdast, type MdastNode } from "satteri";

import {
    exportInstalled,
    installedIndex,
    installedLinks,
    installedPath,
    rewriteMarkdownLinks,
} from "../build/installed.ts";

const SITE = { url: "https://pitlane.tools", name: "Pitlane", description: "Remix 3." };
const DOCS = new URL("../", import.meta.url);
const PACKAGES = new URL("../packages/", DOCS);

let urls = ["/guides", "/guides/hmr", "/guides/prerendering", "/deploy/vercel"];

test("each guide installs under guides/, the landing as its index and deployment pages under deploy/", () => {
    assert.equal(installedPath("/guides"), "guides/index.md");
    assert.equal(installedPath("/guides/hmr"), "guides/hmr.md");
    assert.equal(installedPath("/deploy/vercel"), "guides/deploy/vercel.md");
});

test("a link to an installed guide leads to its copy, relative to the file holding it", () => {
    for (let [from, href, expected] of [
        ["guides/hmr.md", "/guides/prerendering", "prerendering.md"],
        ["guides/hmr.md", "/guides/prerendering/", "prerendering.md"],
        ["guides/hmr.md", "/deploy/vercel#config", "deploy/vercel.md#config"],
        ["guides/deploy/vercel.md", "/guides", "../index.md"],
        ["guides/deploy/vercel.md", "/guides/hmr?x=1#state", "../hmr.md?x=1#state"],
        [
            "dist/dev/README.md",
            "https://pitlane.tools/guides/hmr#state",
            "../../guides/hmr.md#state",
        ],
        // The site's own Markdown of an installed page is that page too.
        ["dist/dev/README.md", "https://pitlane.tools/guides/hmr.md", "../../guides/hmr.md"],
        ["INDEX.md", "/deploy/vercel", "guides/deploy/vercel.md"],
    ] as const) {
        assert.equal(installedLinks(SITE, from, urls)(href), expected, `${href} from ${from}`);
    }
});

test("a link to nothing installed leads to the website, and every other link stays as it is", () => {
    let link = installedLinks(SITE, "guides/hmr.md", urls);
    for (let [href, expected] of [
        ["/package/dev/", "https://pitlane.tools/package/dev/"],
        [
            "/package/dev/function/remix#returns",
            "https://pitlane.tools/package/dev/function/remix#returns",
        ],
        ["/media/lockup.png", "https://pitlane.tools/media/lockup.png"],
        ["https://pitlane.tools/llms.txt", "https://pitlane.tools/llms.txt"],
        ["https://pitlane.tools/package/dev/", "https://pitlane.tools/package/dev/"],
        ["https://remix.run/docs", "https://remix.run/docs"],
        ["https://pitlane.tools.example/guides/hmr", "https://pitlane.tools.example/guides/hmr"],
        ["#state", "#state"],
        ["mailto:hello@pitlane.tools", "mailto:hello@pitlane.tools"],
    ]) {
        assert.equal(link(href), expected, href);
    }
});

test("for any installed file and fragment, a mapped link resolves to the target's copy and keeps the fragment", () => {
    let file = fc.oneof(
        fc.constantFrom("INDEX.md", "dist/dev/README.md", "dist/content/README.md"),
        fc.constantFrom(...urls).map(installedPath),
    );
    let fragment = fc.option(fc.stringMatching(/^[a-z0-9-]{1,20}$/), { nil: undefined });
    fc.assert(
        fc.property(
            file,
            fc.constantFrom(...urls),
            fragment,
            fc.boolean(),
            (from, url, hash, absolute) => {
                let href = `${absolute ? SITE.url : ""}${url}${hash ? `#${hash}` : ""}`;
                let result = installedLinks(SITE, from, urls)(href);
                let [path, kept] = result.split("#");
                assert.equal(posix.join(posix.dirname(from), path!), installedPath(url));
                assert.equal(kept, hash);
            },
        ),
    );
});

test("rewriting a Markdown file's links changes their destinations and nothing else", () => {
    let source = [
        "# @pitlane/dev",
        "",
        'See [HMR](https://pitlane.tools/guides/hmr#state "Hot") and <https://pitlane.tools/guides/spa>.',
        "",
        "Visit https://pitlane.tools/guides/hmr for details.",
        "",
        "Inline `[code](https://pitlane.tools/guides/hmr)` stays.",
        "",
        "```md",
        "[fenced](https://pitlane.tools/guides/hmr)",
        "```",
        "",
        "[Reference][guide] — résumé ✓, then [Remix](https://remix.run).",
        "",
        "[guide]: https://pitlane.tools/guides/crawler",
        "",
    ].join("\n");
    let rewritten = rewriteMarkdownLinks(source, href =>
        href.startsWith("https://pitlane.tools/guides/")
            ? `LOCAL/${href.slice("https://pitlane.tools/guides/".length)}`
            : href,
    );
    assert.equal(
        rewritten,
        [
            "# @pitlane/dev",
            "",
            'See [HMR](LOCAL/hmr#state "Hot") and [https://pitlane.tools/guides/spa](LOCAL/spa).',
            "",
            "Visit [https://pitlane.tools/guides/hmr](LOCAL/hmr) for details.",
            "",
            "Inline `[code](https://pitlane.tools/guides/hmr)` stays.",
            "",
            "```md",
            "[fenced](https://pitlane.tools/guides/hmr)",
            "```",
            "",
            "[Reference][guide] — résumé ✓, then [Remix](https://remix.run).",
            "",
            "[guide]: LOCAL/crawler",
            "",
        ].join("\n"),
    );
});

test("README link destinations use their parsed meaning, not their source spelling", () => {
    let link = installedLinks(SITE, "dist/dev/README.md", urls);
    for (let [source, expected] of [
        ["[Guide](https://pitlane.tools/guides/h&#109;r)", "../../guides/hmr.md"],
        [
            '[Guide](https://pitlane.tools/guides/hmr?x=1&amp;y=2 "https://pitlane.tools/guides/hmr?x=1&y=2")',
            "../../guides/hmr.md?x=1&y=2",
        ],
        [
            "[Guide](https://pitlane.tools/guides/hmr#state\\(ready\\))",
            "../../guides/hmr.md#state(ready)",
        ],
        [
            "[Guide](<https://pitlane.tools/guides/hmr#state(ready)>)",
            "../../guides/hmr.md#state(ready)",
        ],
        ["[](https://pitlane.tools/guides/h&#109;r)", "../../guides/hmr.md"],
        [
            '[Guide][ref]\n\n[ref]: <https://pitlane.tools/guides/h&#109;r> "Title"',
            "../../guides/hmr.md",
        ],
        [
            "[Guide][ref\\]:note]\n\n[ref\\]:note]: https://pitlane.tools/guides/h&#109;r",
            "../../guides/hmr.md",
        ],
    ]) {
        let rewritten = rewriteMarkdownLinks(source!, link);
        assert.deepEqual(links(rewritten), [expected], source);
        if (source!.includes('"')) {
            assert.equal(
                rewritten.slice(rewritten.indexOf('"')),
                source!.slice(source!.indexOf('"')),
            );
        }
    }
});

test("the index lists every guide under its group and every export beside its README", () => {
    let index = installedIndex(
        SITE,
        [
            {
                title: "Getting Started",
                pages: [
                    { url: "/guides", title: "Introduction", description: "Start here." },
                    {
                        url: "/guides/hmr",
                        title: "Hot module replacement",
                        description: "See [the plugin](/guides/prerendering).",
                    },
                    { url: "/guides/prerendering", title: "Prerendering", description: "Pages." },
                ],
            },
            {
                title: "Deployment",
                pages: [{ url: "/deploy/vercel", title: "Vercel", description: "Deploy." }],
            },
        ],
        [
            {
                name: "@pitlane/dev",
                description: "The Vite plugin for Remix",
                path: "dist/dev/README.md",
                exports: ["pitlane/dev", "pitlane/dev/runtime"],
            },
        ],
    );
    let found = links(index);
    for (let url of ["/guides", "/guides/hmr", "/deploy/vercel"]) {
        assert.ok(found.includes(installedPath(url)), url);
    }
    // A description's link resolves from the index, not from the guide.
    assert.deepEqual(
        found.filter(href => href.endsWith("prerendering.md")),
        ["guides/prerendering.md", "guides/prerendering.md"],
    );
    assert.ok(found.includes("dist/dev/README.md"));
    let groups = index.split("\n").filter(line => line.startsWith("#"));
    assert.ok(
        groups.findIndex(line => line.includes("Getting Started")) <
            groups.findIndex(line => line.includes("Deployment")),
    );
    for (let subpath of ["pitlane/dev", "pitlane/dev/runtime"]) {
        assert.ok(index.includes(`\`${subpath}\``), subpath);
    }
});

test("the installed export writes every published guide as plain Markdown whose local links resolve", async () => {
    let out = await mkdtemp(join(tmpdir(), "pitlane-installed-"));
    try {
        let readme = new URL("dev/README.md", PACKAGES).pathname;
        let guides = await exportInstalled({
            out,
            packages: [
                {
                    name: "@pitlane/dev",
                    description: "The Vite plugin for Remix",
                    readme,
                    path: "dist/dev/README.md",
                    exports: ["pitlane/dev", "pitlane/dev/runtime"],
                },
            ],
        });

        let sources = [
            ...(await readdir(new URL("app/content/guides/", DOCS))).map(name => ["guides", name]),
            ...(await readdir(new URL("app/content/deployment/", DOCS))).map(name => [
                "deploy",
                name,
            ]),
        ]
            .filter(([, name]) => !name!.startsWith("_") && /\.mdx?$/.test(name!))
            .map(([section, name]) => {
                let slug = name!.replace(/\.mdx?$/, "");
                return section === "guides"
                    ? slug === "index"
                        ? "/guides"
                        : `/guides/${slug}`
                    : `/deploy/${slug}`;
            });
        assert.deepEqual(guides.map(guide => guide.page.url).sort(), sources.sort());

        let articles = new Map(guides.map(guide => [guide.path, guide.article]));
        let files = [...guides.map(guide => guide.path), "dist/dev/README.md", "INDEX.md"];
        for (let file of files) {
            let markdown = await readFile(join(out, file), "utf8");
            let prose = withoutCode(markdown);
            assert.doesNotMatch(prose, /^\s*(?:import|export)\s/m, `${file} leaks MDX ESM`);
            assert.doesNotMatch(prose, /(?<!\\)<\/?[A-Z]/, `${file} leaks MDX JSX`);
            for (let href of links(markdown)) {
                if (/^[a-z]+:/i.test(href) || href.startsWith("#")) continue;
                let [path, fragment] = href.split("#");
                let target = posix.join(posix.dirname(file), path!.split("?")[0]!);
                await readFile(join(out, target), "utf8").catch(() =>
                    assert.fail(`${file} links ${href}, which is not installed`),
                );
                if (fragment) {
                    let article = articles.get(target);
                    assert.ok(article, `${file} links into ${target}, which has no headings`);
                    assert.ok(
                        article.includes(`id="${decodeURIComponent(fragment)}"`),
                        `${file} links ${href}, a heading ${target} does not have`,
                    );
                }
            }
        }
    } finally {
        await rm(out, { recursive: true, force: true });
    }
});

test("a second export leaves nothing from the first behind", async () => {
    let out = await mkdtemp(join(tmpdir(), "pitlane-installed-"));
    try {
        await mkdir(join(out, "guides/retired"), { recursive: true });
        await writeFile(join(out, "guides/retired/stale.md"), "# Stale\n");
        await writeFile(join(out, "guides/stale.md"), "# Stale\n");
        await exportInstalled({ out, packages: [] });
        let installed = await readdir(join(out, "guides"), { recursive: true });
        assert.ok(!installed.some(path => path.includes("stale")), installed.join(", "));
    } finally {
        await rm(out, { recursive: true, force: true });
    }
});

/** Every link and definition destination a Markdown reader finds, code excluded. */
function links(markdown: string): string[] {
    let found: string[] = [];
    let walk = (node: MdastNode) => {
        if ((node.type === "link" || node.type === "definition") && "url" in node) {
            found.push(String(node.url));
        }
        if ("children" in node) for (let child of node.children as MdastNode[]) walk(child);
    };
    walk(markdownToMdast(markdown));
    return found;
}

/** `markdown` without its fenced code blocks and code spans. */
function withoutCode(markdown: string): string {
    let fenced: string | undefined;
    return markdown
        .split("\n")
        .filter(line => {
            let fence = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
            if (fence && (!fenced || fence.startsWith(fenced))) {
                fenced = fenced ? undefined : fence;
                return false;
            }
            return !fenced;
        })
        .join("\n")
        .replace(/(`+)[^`]*?\1/g, "");
}
