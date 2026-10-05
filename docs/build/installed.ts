import type { MdastNode } from "satteri";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { markdownToMdast } from "satteri";
import { createServer, isRunnableDevEnvironment } from "vite";

import type { DocumentPage } from "../app/document.ts";
import type { renderAuthored } from "./installed-render.tsx";

import { guideGroups } from "../app/components/navigation.ts";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../app/components/site.ts";
import { documentPlugins } from "./compile.ts";
import { exportDocument, linkedDescription, markdownFile, type Site } from "./exports.ts";

export interface InstalledPackage {
    name: string;
    description: string;
    readme: string;
    /** Where the mirror goes, relative to the installed package. */
    path: string;
    /** Every `pitlane/*` subpath the README documents. */
    exports: string[];
}

export interface InstallPlan {
    out: string;
    packages: InstalledPackage[];
}

export interface InstalledGuide {
    path: string;
    page: DocumentPage;
    article: string;
}

type Indexed = Pick<DocumentPage, "url" | "title" | "description">;

const SITE: Site = { url: SITE_URL, name: SITE_NAME, description: SITE_DESCRIPTION };
const DOCS = fileURLToPath(new URL("../", import.meta.url));

/** Maps canonical /guides and /deploy URLs to package-relative Markdown paths. */
export function installedPath(url: string): string {
    if (url === "/guides") return "guides/index.md";
    let [, section, slug] = url.match(/^\/(guides|deploy)\/([^/]+)$/) ?? [];
    if (!section || !slug) throw new Error(`${url} is not a page the installed guides hold.`);
    return section === "guides" ? `guides/${slug}.md` : `guides/deploy/${slug}.md`;
}

/** Rebase installed-guide links; uninstalled root-relative paths lead to the website. */
export function installedLinks(
    site: Site,
    from: string,
    urls: readonly string[],
): (href: string) => string {
    let installed = new Map(urls.map(url => [url.replace(/\/$/, ""), installedPath(url)]));
    let directory = posix.dirname(from);
    return href => {
        let rooted = /^\/(?!\/)/.test(href);
        if (!rooted && href !== site.url && !href.startsWith(`${site.url}/`)) return href;
        let { pathname, search, hash } = new URL(href, site.url);
        let page = pathname.replace(/(?:\/index)?\.md$/, "").replace(/\/$/, "");
        let target = installed.get(page);
        if (target === undefined) return rooted ? `${site.url}${href}` : href;
        return `${posix.relative(directory, target)}${search}${hash}`;
    };
}

/** Replace destinations in source order so README formatting and code examples survive unchanged. */
export function rewriteMarkdownLinks(markdown: string, link: (href: string) => string): string {
    let edits: { start: number; end: number; text: string }[] = [];
    let visit = (node: MdastNode) => {
        if ((node.type === "link" || node.type === "definition") && node.position) {
            let href = String(node.url);
            let target = link(href);
            let { start, end } = node.position;
            let source = markdown.slice(start.offset, end.offset);
            if (target !== href) {
                if (source.startsWith("<") || source === href) {
                    edits.push({
                        start: start.offset!,
                        end: end.offset!,
                        text: `[${href}](${target})`,
                    });
                } else {
                    // The destination follows the link's text, or a definition's label.
                    let after =
                        node.type === "definition"
                            ? source.indexOf("]:")
                            : (node.children.at(-1)?.position?.end.offset ?? start.offset!) -
                              start.offset!;
                    let at = source.indexOf(href, after);
                    if (at === -1) {
                        throw new Error(
                            `Could not find the destination ${href} in ${JSON.stringify(source)}.`,
                        );
                    }
                    edits.push({
                        start: start.offset! + at,
                        end: start.offset! + at + href.length,
                        text: target,
                    });
                }
            }
        }
        if ("children" in node) for (let child of node.children as MdastNode[]) visit(child);
    };
    visit(markdownToMdast(markdown));
    return edits
        .sort((left, right) => right.start - left.start)
        .reduce(
            (text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end),
            markdown,
        );
}

/** Index guides in sidebar order and group public subpaths by their package README. */
export function installedIndex(
    site: Site,
    groups: { title: string; pages: Indexed[] }[],
    packages: Omit<InstalledPackage, "readme">[],
): string {
    let link = installedLinks(
        site,
        "INDEX.md",
        groups.flatMap(group => group.pages.map(page => page.url)),
    );
    let cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
    let guides = groups.map(group =>
        [
            `### ${group.title}`,
            [
                "| Guide | Description |",
                "| --- | --- |",
                ...group.pages.map(
                    page =>
                        `| [${cell(page.title)}](${link(page.url)}) | ${cell(linkedDescription(page.description, link))} |`,
                ),
            ].join("\n"),
        ].join("\n\n"),
    );
    let exports = [
        "| Exports | Description | Docs |",
        "| --- | --- | --- |",
        ...packages.map(
            pkg =>
                `| ${pkg.exports.map(subpath => `\`${subpath}\``).join("<br>")} | ${cell(pkg.description)} | [${pkg.name} README](${pkg.path}) |`,
        ),
    ].join("\n");
    return `${[
        `# ${site.name} Documentation Index`,
        `Search this index by task, export, or description. Everything it lists matches the installed version of \`pitlane\`: the guides cover app workflows and each package README covers its subpaths. For exact signatures and TSDoc, follow the subpath's type declarations to its installed \`@pitlane/*\` package.`,
        "## Guides",
        ...guides,
        "## Package APIs",
        exports,
    ].join("\n\n")}\n`;
}

/** Replace the installed guide set without building the website or its generated API reference. */
export async function exportInstalled(plan: InstallPlan): Promise<InstalledGuide[]> {
    let rendered = await renderGuides();
    let pages = rendered.map(({ page }) => page);
    let urls = pages.map(page => page.url);

    await rm(join(plan.out, "guides"), { recursive: true, force: true });
    let guides = rendered.map(({ page, article }) => ({
        path: installedPath(page.url),
        page,
        article,
    }));
    for (let { path, page, article } of guides) {
        let exported = exportDocument(page, article, installedLinks(SITE, path, urls));
        await write(join(plan.out, path), markdownFile(SITE, exported));
    }

    for (let pkg of plan.packages) {
        let readme = await readFile(pkg.readme, "utf8");
        await write(
            join(plan.out, pkg.path),
            rewriteMarkdownLinks(readme, installedLinks(SITE, pkg.path, urls)),
        );
    }

    let byUrl = new Map(pages.map(page => [page.url, page]));
    let groups = guideGroups(pages).map(group => ({
        title: group.title,
        pages: group.urls.map(url => byUrl.get(url)!),
    }));
    await write(join(plan.out, "INDEX.md"), installedIndex(SITE, groups, plan.packages));
    return guides;
}

async function renderGuides() {
    let server = await createServer({
        configFile: false,
        root: DOCS,
        appType: "custom",
        logLevel: "warn",
        server: { middlewareMode: true, ws: false, watch: null },
        plugins: documentPlugins("build/installed-content.ts"),
    });
    try {
        let ssr = server.environments.ssr;
        if (!isRunnableDevEnvironment(ssr)) {
            throw new Error("The installed export needs a runnable server environment.");
        }
        let module = (await ssr.runner.import("/build/installed-render.tsx")) as {
            renderAuthored: typeof renderAuthored;
        };
        return await module.renderAuthored();
    } finally {
        await server.close();
    }
}

async function write(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
}

/**
 * Run as `node docs/build/installed.ts '<plan>'`, with the plan as JSON: how
 * the `pitlane` package's build writes its documentation.
 */
if (import.meta.main) {
    let [plan] = process.argv.slice(2);
    if (!plan) throw new Error("Usage: node docs/build/installed.ts '<plan as JSON>'");
    await exportInstalled(JSON.parse(plan) as InstallPlan);
}
