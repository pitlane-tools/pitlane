import type { Plugin } from "vite";

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sirv from "sirv";

import type { Documents } from "../app/documents.ts";
import type { SearchDocument } from "./pagefind.ts";

import { markdownPath } from "../app/document.ts";
import { type Exported, llmsFull, llmsIndex, markdownExport, sitemap } from "./exports.ts";
import { writeSearchIndex } from "./pagefind.ts";

export interface PublishOptions {
    site: { url: string; name: string; description: string };
    /** Where `documents.json` goes, for the tooling outside the application that links to its pages. */
    generated: string;
    /** The environment `@cloudflare/vite-plugin` builds the Worker in. */
    server: string;
}

/** What publication reads from the built server entry. */
interface ServerEntry {
    default: { fetch(request: Request): Response | Promise<Response> };
    publication: { documents(): Promise<Documents> };
}

/**
 * Publishes what the site serves as static files, from the application the
 * build just produced: every page is rendered through the built Worker's own
 * `fetch`, with no preferences, and its article becomes the page's Markdown
 * counterpart and search record. The LLM indexes and the sitemap follow from
 * the same documents.
 *
 * A reference page's complete document is also written at its own address,
 * where Cloudflare serves it without running the Worker: no reader preference
 * changes it. An authored page's never is, so its requests reach the Worker
 * and are rendered with the reader's cookies.
 */
export function publish(options: PublishOptions): Plugin {
    let root = process.cwd();
    let server: string | undefined;
    let client: string | undefined;

    return {
        name: "docs-publish",
        sharedDuringBuild: true,

        configResolved(config) {
            root = config.root;
        },

        configureServer(server) {
            let assets = sirv(resolve(root, server.environments.client.config.build.outDir), {
                dev: true,
            });
            server.middlewares.use((request, response, next) => {
                let pathname = new URL(request.url ?? "/", "http://localhost").pathname;
                if (isPublicationAsset(pathname)) assets(request, response, next);
                else next();
            });
        },

        writeBundle(_output, bundle) {
            let outDir = resolve(root, this.environment.config.build.outDir);
            if (this.environment.name === "client") client = outDir;
            if (this.environment.name !== options.server) return;
            let entry = Object.values(bundle).find(file => file.type === "chunk" && file.isEntry);
            if (entry) server = join(outDir, entry.fileName);
        },

        buildApp: {
            order: "post",
            async handler() {
                if (!server || !client) {
                    throw new Error(
                        `[docs-publish] needs both the "${options.server}" and "client" builds.`,
                    );
                }
                let app = await importServer(server);
                let published = await app.publication.documents();
                let exported: Exported[] = [];
                let search: SearchDocument[] = [];

                for (let { page, aliases } of published.all) {
                    let response = await app.default.fetch(
                        new Request(new URL(page.url, options.site.url)),
                    );
                    if (response.status !== 200) {
                        throw new Error(
                            `[docs-publish] ${page.url} answered ${response.status} when rendered.`,
                        );
                    }
                    let html = await response.text();
                    if (page.section === "api") await write(join(client, htmlPath(page.url)), html);
                    let article = articleOf(html, page.url);
                    let markdown = markdownExport(page, article);
                    await write(join(client, markdownPath(page.url)), markdown);
                    exported.push({ page, markdown });
                    search.push({ page, article, aliases });
                }

                let { pages } = published;
                await write(join(client, "llms.txt"), llmsIndex(options.site, exported));
                await write(join(client, "llms-full.txt"), llmsFull(exported));
                await write(
                    join(client, "sitemap.xml"),
                    sitemap(
                        options.site.url,
                        pages.map(page => page.url),
                    ),
                );
                await write(
                    join(resolve(root, options.generated), "documents.json"),
                    `${JSON.stringify(pages, null, 4)}\n`,
                );
                await writeSearchIndex(search, join(client, "pagefind"));
            },
        },
    };
}

function isPublicationAsset(pathname: string): boolean {
    return (
        pathname.startsWith("/pagefind/") ||
        pathname.endsWith(".md") ||
        pathname === "/llms.txt" ||
        pathname === "/llms-full.txt" ||
        pathname === "/sitemap.xml"
    );
}

/**
 * Where Cloudflare's default HTML handling serves a document at `url` as it is
 * spelled: `/symbol` from `symbol.html`, `/module/` from `module/index.html`.
 */
function htmlPath(url: string): string {
    return url.endsWith("/") ? `${url}index.html` : `${url}.html`;
}

/**
 * The built Worker, loaded into this process. Dynamic because the module is
 * this build's output and does not exist before it. It imports nothing only
 * workerd can load, which is what lets the build render with it here.
 */
async function importServer(path: string): Promise<ServerEntry> {
    try {
        let url = pathToFileURL(path);
        // A second build in the same process must not render with the first one.
        url.searchParams.set("t", String(Date.now()));
        return (await import(/* @vite-ignore */ url.href)) as ServerEntry;
    } catch (error) {
        throw new Error(
            `[docs-publish] could not load the built Worker at ${path} in Node to render the site's pages. ` +
                `Keep workerd-only imports such as "cloudflare:workers" out of its module scope.`,
            { cause: error },
        );
    }
}

/** A page's one `<article>`: the compiled body every export is derived from. */
function articleOf(html: string, url: string): string {
    let start = html.indexOf("<article");
    let end = html.lastIndexOf("</article>");
    if (start === -1 || end < start || html.indexOf("<article", start + 1) !== -1) {
        throw new Error(
            `[docs-publish] ${url} must render exactly one <article>, holding its body.`,
        );
    }
    return html.slice(start, end + "</article>".length);
}

async function write(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
}
