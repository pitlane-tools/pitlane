import { type BuildMode, DEFAULT_PREFERENCES, type DocumentPage } from "../document.ts";
import { routes } from "../routes.ts";

export interface NavigationLink {
    title: string;
    url: string;
    current: boolean;
    /**
     * A two-setup guide's page for each build mode, when the link can follow
     * the reader's remembered setup. `url` is the default setup's page.
     */
    variants?: Record<BuildMode, string>;
}

export interface GuideGroup {
    title: string;
    links: NavigationLink[];
}

export interface ApiKindGroup {
    kind: string;
    title: string;
    links: NavigationLink[];
}

export interface ApiModule {
    module: string;
    overview: NavigationLink;
    open: boolean;
    kinds: ApiKindGroup[];
}

export type Navigation =
    | { section: "guides"; label: "Guides"; groups: GuideGroup[] }
    | { section: "api"; label: "API reference"; modules: ApiModule[] };

/**
 * Where the header's section links point. Both are published documents,
 * which indexing the page list verifies, so the 404 document can use them
 * without the list.
 */
export const PRIMARY_LINKS = {
    guides: routes.guide.href({ slug: "vite-plugin" }),
    api: routes.api.href({ path: "dev/" }),
} as const;

export const REPOSITORY_URL = "https://github.com/pitlane-tools/pitlane";

let guide = (title: string, slug: string) => ({ title, url: routes.guide.href({ slug }) });
let deploy = (title: string, slug: string) => ({ title, url: routes.deploy.href({ slug }) });

/**
 * Topical guide groups, in the order the sidebar shows them. Only the URL of
 * one setup is named for a two-mode guide; the other variant comes from the
 * page's own `counterpart` metadata, so the pairing has a single source.
 */
const GUIDE_GROUPS: { title: string; links: { title: string; url: string }[] }[] = [
    {
        title: "Vite Plugin",
        links: [
            guide("Overview", "vite-plugin"),
            guide("Hot Module Replacement", "hmr"),
            guide("Single-Page Apps", "spa"),
        ],
    },
    {
        title: "Deployment",
        links: [
            deploy("Cloudflare Workers", "cloudflare"),
            deploy("Netlify", "netlify"),
            deploy("Vercel", "vercel"),
            deploy("Railway", "railway"),
            deploy("Deno Deploy", "deno-deploy"),
            deploy("GitHub Pages", "github-pages"),
        ],
    },
    {
        title: "Crawler",
        links: [guide("Overview", "crawler"), guide("Prerendering", "prerendering")],
    },
    { title: "Theme", links: [guide("Overview", "theme")] },
    { title: "Content", links: [guide("Overview", "content")] },
    { title: "Data", links: [guide("Cloudflare D1", "cloudflare-d1")] },
];

const KIND_TITLES: Record<string, string> = {
    function: "Functions",
    class: "Classes",
    interface: "Interfaces",
    type: "Types",
    variable: "Variables",
    enum: "Enums",
    namespace: "Namespaces",
};
const KIND_ORDER = Object.keys(KIND_TITLES);

interface SiteIndex {
    guides: {
        title: string;
        links: { title: string; pages: Record<BuildMode, DocumentPage> | DocumentPage }[];
    }[];
    modules: {
        module: string;
        overview: DocumentPage;
        kinds: { kind: string; title: string; pages: DocumentPage[] }[];
    }[];
}

let indexes = new WeakMap<DocumentPage[], SiteIndex>();

function indexPages(pages: DocumentPage[]): SiteIndex {
    let index = indexes.get(pages);
    if (index) return index;
    let published = new Set(pages.map(page => page.url));
    for (let url of Object.values(PRIMARY_LINKS)) {
        if (!published.has(url))
            throw new Error(`The header links to ${url}, which is not a published document.`);
    }
    index = { guides: indexGuides(pages), modules: indexModules(pages) };
    indexes.set(pages, index);
    return index;
}

function indexGuides(pages: DocumentPage[]): SiteIndex["guides"] {
    let byUrl = new Map(pages.map(page => [page.url, page]));
    let placed = new Set<string>();
    let guides = GUIDE_GROUPS.map(group => ({
        title: group.title,
        links: group.links.map(link => {
            let page = byUrl.get(link.url);
            if (!page)
                throw new Error(
                    `Guide navigation names ${link.url}, which is not a published document.`,
                );
            placed.add(page.url);
            if (!page.buildMode) return { title: link.title, pages: page };
            let counterpart = page.counterpart ? byUrl.get(page.counterpart) : undefined;
            if (!counterpart?.buildMode || counterpart.buildMode === page.buildMode) {
                throw new Error(
                    `${page.url} is a ${page.buildMode} guide without a published counterpart.`,
                );
            }
            placed.add(counterpart.url);
            return {
                title: link.title,
                pages: { [page.buildMode]: page, [counterpart.buildMode]: counterpart } as Record<
                    BuildMode,
                    DocumentPage
                >,
            };
        }),
    }));
    let orphans = pages.filter(page => page.section !== "api" && !placed.has(page.url));
    if (orphans.length) {
        throw new Error(
            `Guide navigation has no entry for ${orphans.map(page => page.url).join(", ")}.`,
        );
    }
    return guides;
}

function indexModules(pages: DocumentPage[]): SiteIndex["modules"] {
    let modules = new Map<string, DocumentPage[]>();
    for (let page of pages) {
        if (page.section !== "api") continue;
        if (!page.module || !page.kind)
            throw new Error(`API document ${page.url} lacks module or kind metadata.`);
        let members = modules.get(page.module) ?? [];
        members.push(page);
        modules.set(page.module, members);
    }
    return [...modules]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([module, members]) => {
            let overview = members.find(page => page.kind === "module");
            if (!overview) throw new Error(`API module ${module} has no overview document.`);
            let unknown = members.find(
                page => page.kind !== "module" && !(page.kind! in KIND_TITLES),
            );
            if (unknown)
                throw new Error(`API document ${unknown.url} has unknown kind ${unknown.kind}.`);
            let kinds = KIND_ORDER.map(kind => ({
                kind,
                title: KIND_TITLES[kind]!,
                pages: members
                    .filter(page => page.kind === kind)
                    .sort((left, right) => left.title.localeCompare(right.title)),
            })).filter(group => group.pages.length);
            return { module, overview, kinds };
        });
}

function toLink(page: DocumentPage, current: DocumentPage, title = page.title): NavigationLink {
    return { title, url: page.url, current: page.url === current.url };
}

/**
 * The sidebar for `page`. The guide being read keeps the setup its URL names;
 * any other two-setup guide links to the default setup's page and carries
 * both, so the browser can follow the reader's remembered setup instead.
 */
export function buildNavigation(pages: DocumentPage[], page: DocumentPage): Navigation {
    let index = indexPages(pages);
    if (page.section === "api") {
        return {
            section: "api",
            label: "API reference",
            modules: index.modules.map(module => ({
                module: module.module,
                overview: toLink(module.overview, page, "Overview"),
                open: module.module === page.module,
                kinds: module.kinds.map(group => ({
                    kind: group.kind,
                    title: group.title,
                    links: group.pages.map(member => toLink(member, page)),
                })),
            })),
        };
    }
    return {
        section: "guides",
        label: "Guides",
        groups: index.guides.map(group => ({
            title: group.title,
            links: group.links.map(link => {
                if ("url" in link.pages) return toLink(link.pages, page, link.title);
                let variants = link.pages;
                if (page.buildMode && variants[page.buildMode].url === page.url)
                    return toLink(page, page, link.title);
                return {
                    ...toLink(variants[DEFAULT_PREFERENCES.buildMode], page, link.title),
                    variants: { vite: variants.vite.url, "no-build": variants["no-build"].url },
                };
            }),
        })),
    };
}

/** A two-setup guide's page for each build mode, or nothing for any other page. */
export function buildModeVariants(page: DocumentPage): Record<BuildMode, string> | undefined {
    let { url, buildMode, counterpart } = page;
    if (!buildMode || !counterpart) return undefined;
    return buildMode === "vite"
        ? { vite: url, "no-build": counterpart }
        : { vite: counterpart, "no-build": url };
}
