import { buildModeVariants, buildNavigation, PRIMARY_LINKS } from "../app/components/navigation.ts";
import {
    BUILD_MODE_LABELS,
    type DocumentPage,
    markdownPath,
    PREFERENCE_CHOICES,
} from "../app/document.ts";
import { articleToMarkdown } from "./markdown.ts";

export interface Site {
    url: string;
    name: string;
    description: string;
}

/** What an export says about the page it came from. */
export type ExportedPage = Pick<
    DocumentPage,
    "url" | "title" | "description" | "buildMode" | "counterpart"
>;

/** A page's Markdown: what it says about its page, and the body under its title. */
export interface Exported {
    page: ExportedPage;
    body: string;
}

/** What the home page shows, which its Markdown says in prose. */
export interface Home {
    description: string;
    packages: {
        name: string;
        purpose: string;
        description: string;
        file: string;
        code: string;
        /** The package's guide. */
        href: string;
    }[];
    platforms: { name: string; detail: string; href: string }[];
    /** The command that scaffolds an app from the template. */
    scaffold: string;
}

/**
 * Where a link leads in the Markdown corpus. A link to one of the published
 * pages at `urls`, root-relative or on the site, with or without its trailing
 * slash, leads to that page's Markdown, absolute and keeping its query and
 * fragment. Any other link is left as it is.
 */
export function markdownLinks(site: Site, urls: readonly string[]): (href: string) => string {
    let pages = new Map(urls.map(url => [url.replace(/\/$/, ""), url]));
    return href => {
        let onSite = /^\/(?!\/)/.test(href) || href === site.url || href.startsWith(`${site.url}/`);
        if (!onSite) return href;
        let { pathname, search, hash } = new URL(href, site.url);
        let url = pages.get(pathname.replace(/\/$/, ""));
        return url === undefined ? href : `${site.url}${markdownPath(url)}${search}${hash}`;
    };
}

/**
 * A page's Markdown from its rendered article: the build-mode switch as a
 * line naming this page's setup and linking the other's, then the article
 * without its heading, since the export writes the page's own title instead.
 */
export function exportDocument(
    page: DocumentPage,
    article: string,
    link: (href: string) => string,
): Exported {
    let variants = buildModeVariants(page);
    let setup =
        page.buildMode &&
        variants &&
        `This guide for: ${PREFERENCE_CHOICES.buildMode
            .map(mode =>
                mode === page.buildMode
                    ? `**${BUILD_MODE_LABELS[mode]}**`
                    : `[${BUILD_MODE_LABELS[mode]}](${link(variants[mode])})`,
            )
            .join(" · ")}`;
    let body = articleToMarkdown(article, page.url, { link });
    return {
        page: {
            url: page.url,
            title: page.title,
            description: page.description.replace(
                /\]\(([^)\s]+)\)/g,
                (_target, href: string) => `](${link(href)})`,
            ),
            buildMode: page.buildMode,
            counterpart: page.counterpart,
        },
        body: setup ? `${setup}\n\n${body}` : body,
    };
}

/** The home page's Markdown: what each package is for, with its example and guide, where an app deploys, and how to start one. */
export function exportHome(
    site: Site,
    home: Home,
    pages: DocumentPage[],
    link: (href: string) => string,
): Exported {
    let named = (url: string) => {
        let page = pages.find(page => page.url === url);
        if (!page)
            throw new Error(
                `[docs-publish] The home page links ${url}, which is not a published document.`,
            );
        return `[${page.title}](${link(url)})`;
    };
    let packages = home.packages.map(pkg => {
        let reference = pages.find(page => page.kind === "module" && page.module === pkg.name);
        if (!reference) throw new Error(`[docs-publish] ${pkg.name} has no reference overview.`);
        return [
            `### ${pkg.name}: ${pkg.purpose}`,
            pkg.description,
            `\`\`\`ts title=${JSON.stringify(pkg.file)}\n${pkg.code}\n\`\`\``,
            `Guide: ${named(pkg.href)} · Reference: ${named(reference.url)}`,
        ].join("\n\n");
    });
    let platforms = home.platforms.map(
        platform => `- [${platform.name}](${link(platform.href)}): ${platform.detail}`,
    );
    let body = [
        `Start with ${named(PRIMARY_LINKS.guides)}.`,
        "## Packages",
        ...packages,
        "## Deployment",
        platforms.join("\n"),
        "## Start from a template",
        `\`\`\`sh\n${home.scaffold}\n\`\`\``,
    ].join("\n\n");
    return {
        page: { url: "/", title: site.name, description: home.description },
        body: `${body}\n`,
    };
}

/** A page's Markdown file: its metadata as frontmatter, then its title and body. */
export function markdownFile(site: Site, { page, body }: Exported): string {
    let fields = {
        title: page.title,
        description: page.description,
        url: `${site.url}${page.url}`,
        buildMode: page.buildMode,
        counterpart: page.counterpart && `${site.url}${markdownPath(page.counterpart)}`,
    };
    let frontmatter = Object.entries(fields)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join("\n");
    return `---\n${frontmatter}\n---\n\n# ${page.title}\n\n${body}`;
}

/**
 * The pages in the order the sidebar shows them, under its headings: each
 * guide group with both setups of a two-setup guide, then each reference
 * module, its overview first.
 */
export function readingOrder(pages: DocumentPage[]): { heading: string; urls: string[] }[] {
    let start = (url: string) => pages.find(page => page.url === url)!;
    let guides = buildNavigation(pages, start(PRIMARY_LINKS.guides));
    let api = buildNavigation(pages, start(PRIMARY_LINKS.api));
    if (guides.section !== "guides" || api.section !== "api") {
        throw new Error(
            "[docs-publish] The header's section links must open the guides and the reference.",
        );
    }
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
                ...module.kinds.flatMap(kind => kind.links.map(page => page.url)),
            ],
        })),
    ];
}

/**
 * The `llms.txt` index: what Pitlane is and where to start, then every page's
 * Markdown under the sidebar's headings, in its order.
 */
export function llmsIndex(
    site: Site,
    home: Home,
    pages: DocumentPage[],
    exported: ReadonlyMap<string, Exported>,
): string {
    let entry = (url: string) => {
        let { page } = exported.get(url)!;
        return `- [${page.title}](${site.url}${markdownPath(url)}): ${page.description}`;
    };
    let guide = exported.get(PRIMARY_LINKS.guides)!.page;
    let packages = home.packages.map(pkg => `${pkg.name} (${pkg.purpose.toLowerCase()})`);
    let intro = [
        `${home.description} Its packages are independent: ${packages.join(", ")}.`,
        `Start with [${guide.title}](${site.url}${markdownPath(guide.url)}). ` +
            `[The home page](${site.url}${markdownPath("/")}) shows what each package is for, with an example.`,
        "Every page listed here is Markdown, at its HTML page's address with `.md` added, or `index.md` for an address ending in `/`. " +
            `[llms-full.txt](${site.url}/llms-full.txt) holds every page in one file.`,
    ];
    let sections = readingOrder(pages).map(
        ({ heading, urls }) => `## ${heading}\n\n${urls.map(entry).join("\n")}`,
    );
    return `# ${site.name}\n\n> ${site.description}\n\n${[...intro, ...sections].join("\n\n")}\n`;
}

/**
 * The whole corpus in one file, page after page, opening with how to split
 * it. Every page starts with its title as the only level-one heading it has,
 * then the address of its Markdown on a `Source:` line, then its description.
 */
export function llmsFull(site: Site, exported: Exported[]): string {
    let preface = [
        `This file is ${site.name}'s documentation, every page as Markdown: the home page, then every page in the order [llms.txt](${site.url}/llms.txt) lists it.`,
        "Each page begins with its title as a level-one heading (`# Title`), then, after a blank line, `Source: ` and the address of the page's own Markdown, then its description as a quote. " +
            "A page runs until the next level-one heading; none appears anywhere else outside code blocks.",
    ];
    let sections = exported.map(
        ({ page, body }) =>
            `# ${page.title}\n\nSource: ${site.url}${markdownPath(page.url)}\n\n> ${page.description}\n\n${body.trimEnd()}`,
    );
    return `${[...preface, ...sections].join("\n\n")}\n`;
}

/**
 * The `_headers` file Cloudflare applies to the published files: each page
 * links its Markdown as an alternate, and Markdown and the LLM indexes declare
 * their character set. A rule per URL shape rather than per page, since a
 * placeholder can carry the page's path into its link and Cloudflare allows
 * only a hundred rules. Rules apply in order, so Markdown files, which the
 * shapes also match, drop the link afterwards.
 */
export function headersFile(site: Site, urls: readonly string[]): string {
    let shapes = new Set(
        urls.map(url =>
            url
                .split("/")
                .map((segment, index) => (index < 2 || segment === "" ? segment : `:p${index}`))
                .join("/"),
        ),
    );
    let rules = [
        ...[...shapes].map(
            shape =>
                `${shape}\n  Link: <${site.url}${markdownPath(shape)}>; rel="alternate"; type="text/markdown"`,
        ),
        "/*.md\n  ! Link\n  Content-Type: text/markdown; charset=utf-8",
        "/llms.txt\n  Content-Type: text/plain; charset=utf-8",
        "/llms-full.txt\n  Content-Type: text/plain; charset=utf-8",
    ];
    return `${rules.join("\n\n")}\n`;
}

/** The sitemap of every public URL, the home page first. */
export function sitemap(siteUrl: string, urls: string[]): string {
    let entries = ["/", ...urls].map(
        url => `    <url>\n        <loc>${siteUrl}${url}</loc>\n    </url>`,
    );
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
}
