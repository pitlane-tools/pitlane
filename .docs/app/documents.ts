import type { CollectionEntry } from "@pitlane/content";

import { createElement, type RemixNode } from "remix/ui";

import type { BuildMode, CompiledHeading, DocumentPage } from "./document.ts";

import { content } from "./content.ts";
import { outline } from "./outline.ts";
import { routes } from "./routes.ts";

/** Another public name the same declaration is exported under. */
export interface Alias {
    module: string;
    name: string;
}

/** A published page and the compiled body that renders it. */
export interface Document {
    page: DocumentPage;
    /** Other public names the same declaration is exported under; only reference pages have any. */
    aliases: Alias[];
    /** The page's body, ready to render inside its article. */
    body(): Promise<RemixNode>;
}

/** The published corpus, and the lookups a request needs. */
export interface Documents {
    /** In navigation order: guides, then deployment pages, then the API reference. */
    all: Document[];
    pages: DocumentPage[];
    byUrl: ReadonlyMap<string, Document>;
    /** Each page's URL, keyed by the same URL without a trailing slash. */
    canonical: ReadonlyMap<string, string>;
}

let published: Promise<Documents> | undefined;

/**
 * Every published document. Resolved once per process, and deterministic, so
 * an authoring error here fails the build's publication step before any
 * request can meet it.
 */
export function documents(): Promise<Documents> {
    return (published ??= load());
}

async function load(): Promise<Documents> {
    let [guides, deploy, api] = await Promise.all([
        content.guides.getCollection(),
        content.deploy.getCollection(),
        content.api.getCollection(),
    ]);
    let guideIds = new Set(guides.map(guide => guide.id));

    let all = await Promise.all([
        ...guides.map(guide =>
            document(guide, {
                ...page(routes.guide.href({ slug: guide.id }), "guides", guide.data),
                ...variant(guide.id, guide.data.build, guideIds),
            }),
        ),
        ...deploy.map(entry =>
            document(entry, page(routes.deploy.href({ slug: entry.id }), "deploy", entry.data)),
        ),
        ...api.map(entry =>
            document(
                entry,
                {
                    ...page(referenceUrl(entry.data.url), "api", entry.data),
                    module: entry.data.module,
                    kind: entry.data.kind,
                },
                entry.data.aliases,
            ),
        ),
    ]);

    return {
        all,
        pages: all.map(({ page }) => page),
        byUrl: new Map(all.map(document => [document.page.url, document])),
        canonical: new Map(all.map(({ page }) => [page.url.replace(/\/$/, ""), page.url])),
    };
}

type Published = CollectionEntry<
    typeof content.guides | typeof content.deploy | typeof content.api
>;

/**
 * A page and its body from the entry the content layer compiled. Its heading
 * list carries each heading's variant context, which the page resolves into
 * the outline its own variant shows.
 */
async function document(
    entry: Published,
    metadata: Omit<DocumentPage, "headings">,
    aliases: Alias[] = [],
): Promise<Document> {
    let { Content, headings } = await entry.render();
    let source = entry.filePath ?? `${entry.collection}/${entry.id}`;
    return {
        page: { ...metadata, headings: outline(metadata, headings as CompiledHeading[], source) },
        aliases,
        body: async () => createElement(Content, {}),
    };
}

/** A reference page's URL, which the generated manifest names and the api route must claim. */
function referenceUrl(url: string): string {
    let base = routes.api.href({ path: "" });
    if (!url.startsWith(base)) {
        throw new Error(`Reference page ${url} is outside the api route at ${base}.`);
    }
    return url;
}

function page(
    url: string,
    section: DocumentPage["section"],
    data: { title: string; description: string },
): Omit<DocumentPage, "headings"> {
    return { url, title: data.title, description: data.description, section };
}

/**
 * A two-mode guide names its counterpart by convention, `<slug>` for the Vite
 * page and `<slug>-no-build` for the No Build one, so a `build:` declaration
 * whose sibling is missing fails here rather than publishing a switch that
 * leads nowhere.
 */
function variant(
    id: string,
    mode: BuildMode | undefined,
    guideIds: ReadonlySet<string>,
): Pick<DocumentPage, "buildMode" | "counterpart"> {
    if (!mode) return {};
    let sibling = mode === "vite" ? `${id}-no-build` : id.replace(/-no-build$/, "");
    if (sibling === id || !guideIds.has(sibling)) {
        throw new Error(
            `docs/guides/${id} declares "build: ${mode}", but its ` +
                `${mode === "vite" ? "No Build" : "Vite"} counterpart docs/guides/${sibling} does not exist.`,
        );
    }
    return { buildMode: mode, counterpart: routes.guide.href({ slug: sibling }) };
}
