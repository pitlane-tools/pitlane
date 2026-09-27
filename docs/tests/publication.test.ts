import type { HastNode } from "satteri";

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { htmlToHast, markdownToHtml } from "satteri";

import { buildNavigation, PRIMARY_LINKS } from "../app/components/navigation.ts";
import { type DocumentPage, markdownPath, PREFERENCE_CHOICES } from "../app/document.ts";
import { examples } from "../app/home/examples.ts";
import { SECTORS } from "../app/home/lap-sequence.ts";
import { platforms } from "../app/home/overview.ts";

type Element = Extract<HastNode, { type: "element" }>;

const SITE = "https://pitlane.tools";
const CLIENT = new URL("../dist/client/", import.meta.url);

let pages = JSON.parse(
    await readFile(new URL("../.generated/documents.json", import.meta.url), "utf8"),
) as DocumentPage[];
let byUrl = new Map(pages.map(page => [page.url, page]));

let published = (path: string) => readFile(new URL(`.${path}`, CLIENT), "utf8");
let markdownUrl = (url: string) => `${SITE}${markdownPath(url)}`;

function elements(node: HastNode, tagName: string): Element[] {
    if (node.type !== "root" && node.type !== "element") return [];
    let found = node.type === "element" && node.tagName === tagName ? [node] : [];
    return found.concat(...node.children.map(child => elements(child, tagName)));
}

function text(node: HastNode): string {
    if (node.type === "text") return node.value;
    return node.type === "element" || node.type === "root" ? node.children.map(text).join("") : "";
}

function classes(node: Element): string[] {
    return [node.properties?.className ?? []].flat().map(String);
}

/** Every link a Markdown reader finds in `markdown`, code excluded. */
function links(markdown: string): string[] {
    let root = htmlToHast(markdownToHtml(markdown).html, { fragment: true });
    return elements(root, "a").map(anchor => String(anchor.properties?.href));
}

/** Level-one headings outside fenced code. */
function titles(markdown: string): string[] {
    let fenced = false;
    return markdown.split("\n").flatMap(line => {
        if (/^(```|~~~)/.test(line)) fenced = !fenced;
        return !fenced && line.startsWith("# ") ? [line.slice(2)] : [];
    });
}

/** Every page's Markdown the build published. */
async function exportedFiles(): Promise<URL[]> {
    let paths = await readdir(CLIENT, { recursive: true });
    return paths.filter(path => path.endsWith(".md")).map(path => new URL(path, CLIENT));
}

/** The sidebar's reading order: each guide group, both setups of a two-setup guide, then each API module. */
function readingOrder() {
    let guides = buildNavigation(pages, byUrl.get(PRIMARY_LINKS.guides)!);
    let api = buildNavigation(pages, byUrl.get(PRIMARY_LINKS.api)!);
    assert.ok(guides.section === "guides" && api.section === "api");
    return [
        ...guides.groups.map(group => ({
            heading: group.title,
            urls: group.links.flatMap(link =>
                link.variants
                    ? PREFERENCE_CHOICES.buildMode.map(mode => link.variants![mode])
                    : [link.url],
            ),
        })),
        ...api.modules.map(module => ({
            heading: `${module.module} API`,
            urls: [
                module.overview.url,
                ...module.kinds.flatMap(kind => kind.links.map(link => link.url)),
            ],
        })),
    ];
}

test("llms.txt says where to start, then lists every page under the sidebar's groups in its order", async () => {
    let index = await published("/llms.txt");
    let [intro, ...sections] = index.split(/^## /m);
    assert.match(intro!, /^# Pitlane\n\n> .+\n\n/);
    for (let href of [
        markdownUrl(PRIMARY_LINKS.guides),
        markdownUrl("/"),
        `${SITE}/llms-full.txt`,
    ]) {
        assert.ok(links(intro!).includes(href), `the introduction links ${href}`);
    }
    let listed = sections.map(section => {
        let [heading, ...lines] = section.trim().split("\n");
        return {
            heading: heading!,
            urls: lines
                .filter(line => line.startsWith("- "))
                .map(line => line.match(/^- \[[^\]]+\]\(([^)]+)\)/)![1]!),
        };
    });
    assert.deepEqual(
        listed,
        readingOrder().map(({ heading, urls }) => ({ heading, urls: urls.map(markdownUrl) })),
    );
    assert.doesNotMatch(index, /\]\(\//, "llms.txt links nothing by a root-relative URL");
});

test("llms-full.txt splits into the home page and every page llms.txt lists, each under its own title and source", async () => {
    let full = await published("/llms-full.txt");
    assert.doesNotMatch(full.split("\n")[0]!, /^# /, "the file opens by explaining its structure");
    assert.match(full.slice(0, full.search(/^# /m)), /Source:/);
    let sections = [...full.matchAll(/^# (.+)\n\nSource: (\S+)$/gm)];
    let order = readingOrder().flatMap(({ urls }) => urls);
    assert.deepEqual(
        sections.map(([, , source]) => source),
        [markdownUrl("/"), ...order.map(markdownUrl)],
    );
    assert.deepEqual(
        titles(full),
        sections.map(([, title]) => title),
        "no page has a second level-one heading",
    );
    // Reference pages are titled by symbol, which two modules can share; each is told apart by its source.
    let authored = pages.filter(page => page.section !== "api").map(page => page.title);
    assert.equal(new Set(authored).size, authored.length, "every guide's title is its own");
    assert.deepEqual(
        sections.slice(1).map(([, title]) => title),
        order.map(url => byUrl.get(url)!.title),
    );
});

test("each exported page is headed by its title, and names its URL and any build mode and counterpart", async () => {
    for (let page of pages) {
        let file = await published(markdownPath(page.url));
        let [, frontmatter, body] = file.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/)!;
        let fields = Object.fromEntries(
            frontmatter!.split("\n").map(line => {
                let [, key, value] = line.match(/^(\w+): (.*)$/)!;
                return [key, JSON.parse(value!)];
            }),
        );
        assert.equal(fields.url, `${SITE}${page.url}`, page.url);
        assert.equal(fields.buildMode, page.buildMode, page.url);
        assert.equal(
            fields.counterpart,
            page.counterpart && markdownUrl(page.counterpart),
            page.url,
        );
        assert.deepEqual(titles(body!), [page.title], page.url);
        if (page.counterpart) {
            let line = body!.split("\n")[2]!;
            assert.match(line, /^This guide for: /, page.url);
            assert.ok(links(line).includes(markdownUrl(page.counterpart)), page.url);
        }
    }
});

test("exports link to the Markdown of every published page they name", async () => {
    let documentUrls = new Set(["/", ...pages.map(page => page.url)]);
    let files = await exportedFiles();
    let bodies = await Promise.all([
        ...files.map(file => readFile(file, "utf8")),
        published("/llms-full.txt"),
    ]);
    for (let body of bodies) {
        for (let href of links(body)) {
            let site = href.match(/^(?:https:\/\/pitlane\.tools)?(\/[^#?]*)?(?:[#?].*)?$/);
            if (!site || (!href.startsWith("/") && !href.startsWith(SITE))) continue;
            let path = site[1] || "/";
            assert.ok(
                !documentUrls.has(path) && !documentUrls.has(`${path}/`),
                `${href} leads to a page's HTML, not its Markdown`,
            );
            if (path.endsWith(".md")) assert.ok(href.startsWith(SITE), href);
        }
    }
});

test("the home page's Markdown says what each package does, where it deploys, and how to start", async () => {
    let home = await published("/index.md");
    assert.match(
        home,
        /^---\ntitle: "Pitlane"\n[\s\S]*\nurl: "https:\/\/pitlane\.tools\/"\n---\n\n# Pitlane\n/,
    );
    let hrefs = links(home);
    for (let example of examples) {
        assert.ok(home.includes(example.name), example.name);
        assert.ok(home.includes(example.description), example.name);
        assert.ok(home.includes(`title="${example.file}"\n${example.code}\n`), example.name);
        assert.ok(hrefs.includes(markdownUrl(example.href)), example.href);
    }
    for (let platform of platforms) {
        assert.ok(hrefs.includes(markdownUrl(`/deploy/${platform.slug}`)), platform.slug);
    }
    assert.ok(home.includes(`\`\`\`sh\n${SECTORS[0]!.command}\n\`\`\``));
    assert.equal(
        (await published("/llms-full.txt")).match(/^# .+\n\nSource: (\S+)$/m)?.[1],
        markdownUrl("/"),
    );
});

test("every published page names its Markdown in its head; the 404 page names none", async () => {
    for (let url of ["/", ...pages.map(page => page.url)]) {
        let file = url.endsWith("/") ? `${url}index.html` : `${url}.html`;
        let head = elements(htmlToHast(await published(file)), "head")[0]!;
        let alternates = elements(head, "link")
            .filter(link => String(link.properties?.rel) === "alternate")
            .map(link => ({ type: link.properties?.type, href: link.properties?.href }));
        assert.deepEqual(alternates, [{ type: "text/markdown", href: markdownUrl(url) }], url);
    }
    let notFound = elements(htmlToHast(await published("/404.html")), "link").filter(
        link => String(link.properties?.rel) === "alternate",
    );
    assert.deepEqual(notFound, []);
});

test("every page's footer links llms.txt", async () => {
    for (let file of ["/index.html", "/guides/vite-plugin.html", "/404.html"]) {
        let footer = elements(htmlToHast(await published(file)), "footer")[0]!;
        assert.ok(
            elements(footer, "a").some(anchor => anchor.properties?.href === "/llms.txt"),
            file,
        );
    }
});

test("an install group exports as the npm command and a sentence naming the other managers", async () => {
    let guide = await published("/guides/vite-plugin.md");
    let fences = [...guide.matchAll(/^```sh\n([\s\S]*?)\n```\n\n(.+)$/gm)].filter(([, code]) =>
        code!.includes("@pitlane/dev"),
    );
    assert.ok(fences.length > 0);
    for (let [, code, sentence] of fences) {
        assert.equal(code, "npm add -D @pitlane/dev");
        for (let manager of PREFERENCE_CHOICES.packageManager.filter(name => name !== "npm")) {
            assert.match(sentence!, new RegExp(`\\b${manager}\\b`), manager);
        }
        assert.match(sentence!, /`npm:/);
    }
    for (let manager of ["yarn", "pnpm", "bun", "deno", "vp", "vlt", "nub"]) {
        assert.doesNotMatch(guide, new RegExp(`^${manager} add`, "m"), manager);
    }
});

test("every built code block's text is the code it displays, line by line", async () => {
    for (let file of ["/deploy/railway.html", "/guides/vite-plugin.html", "/index.html"]) {
        let root = htmlToHast(await published(file));
        let payloads = elements(root, "button")
            .filter(button => typeof button.properties?.dataCode === "string")
            .map(button => (button.properties.dataCode as string).replace(/\u007f/g, "\n"));
        // The examples the build highlighted, which record their language.
        let blocks = elements(root, "pre").filter(pre => "dataLanguage" in (pre.properties ?? {}));
        assert.ok(
            blocks.some(pre => text(pre).includes("\n")),
            file,
        );
        for (let pre of blocks) {
            let [code] = elements(pre, "code");
            assert.ok(payloads.includes(text(code!)), `${file}: ${text(code!)}`);
            let language = String(pre.properties?.dataLanguage ?? "");
            if (language) assert.ok(classes(code!).includes(`language-${language}`), file);
        }
    }
});
