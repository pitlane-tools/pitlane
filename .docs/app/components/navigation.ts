import type { BuildMode, DocumentPage, Preferences } from "../document.ts";

export interface NavigationLink {
    title: string;
    url: string;
    current: boolean;
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

/** One step of the trail above a page, linked when it has a page of its own. */
export interface Breadcrumb {
    text: string;
    href?: string;
}

/**
 * Where the header's section links point. Both are published documents,
 * which indexing the page list verifies, so the 404 document can use them
 * without the list.
 */
export const PRIMARY_LINKS = { guides: "/guides/vite-plugin", api: "/package/dev/" } as const;

export const REPOSITORY_URL = "https://github.com/pitlane-tools/pitlane";

/**
 * Topical guide groups, in the order the sidebar shows them. Only the URL of
 * one setup is named for a two-mode guide; the other variant comes from the
 * page's own `counterpart` metadata, so the pairing has a single source.
 */
const GUIDE_GROUPS: { title: string; links: { title: string; url: string }[] }[] = [
    {
        title: "Vite Plugin",
        links: [
            { title: "Overview", url: PRIMARY_LINKS.guides },
            { title: "Hot Module Replacement", url: "/guides/hmr" },
            { title: "Single-Page Apps", url: "/guides/spa" },
        ],
    },
    {
        title: "Deployment",
        links: [
            { title: "Cloudflare Workers", url: "/deploy/cloudflare" },
            { title: "Netlify", url: "/deploy/netlify" },
            { title: "Vercel", url: "/deploy/vercel" },
            { title: "Railway", url: "/deploy/railway" },
            { title: "Deno Deploy", url: "/deploy/deno-deploy" },
            { title: "GitHub Pages", url: "/deploy/github-pages" },
        ],
    },
    {
        title: "Crawler",
        links: [
            { title: "Overview", url: "/guides/crawler" },
            { title: "Prerendering", url: "/guides/prerendering" },
        ],
    },
    { title: "Theme", links: [{ title: "Overview", url: "/guides/theme" }] },
    { title: "Content", links: [{ title: "Overview", url: "/guides/content" }] },
    { title: "Data", links: [{ title: "Cloudflare D1", url: "/guides/cloudflare-d1" }] },
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
 * The sidebar for `page`. A two-mode guide is addressed in the setup the
 * reader chose, except the one being read, which keeps the setup its URL names.
 */
export function buildNavigation(
    pages: DocumentPage[],
    page: DocumentPage,
    preferences: Preferences,
): Navigation {
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
                let selected =
                    page.buildMode && variants[page.buildMode].url === page.url
                        ? page
                        : variants[preferences.buildMode];
                return toLink(selected, page, link.title);
            }),
        })),
    };
}

/** The trail above `page`: its section, and for a symbol, the module that exports it. */
export function breadcrumbs(pages: DocumentPage[], page: DocumentPage): Breadcrumb[] {
    switch (page.section) {
        case "guides":
            return [{ text: "Guides" }];
        case "deploy":
            return [{ text: "Guides" }, { text: "Deployment" }];
        case "api": {
            if (page.kind === "module") return [{ text: "Packages" }];
            let overview = indexPages(pages).modules.find(
                module => module.module === page.module,
            )?.overview;
            return [{ text: "Packages" }, { text: page.module!, href: overview?.url }];
        }
    }
}
