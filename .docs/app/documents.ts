import { createElement, type RemixNode } from "remix/ui";

import type { BuildMode, CompiledHeading, DocumentPage } from "./document.ts";

import { content } from "./content.ts";
import { outline } from "./outline.ts";

/** An authored body: a function of props, which is what an MDX import is. */
type Component = (props: Record<string, never>) => RemixNode;

/**
 * Every publishable body, keyed by its path in the repository. `build/compile.ts`
 * compiles each import: an authored guide or deployment page to a component,
 * a generated reference page to the HTML its article shows. The bodies load
 * on demand, the outlines up front.
 */
let components = import.meta.glob<Component>(
    ["./docs/guides/*.{md,mdx}", "./docs/deploy/*.{md,mdx}", "!./docs/*/_*"],
    { base: "../../", import: "default" },
);
let references = import.meta.glob<string>("./docs/package/**/*.md", {
    base: "../../",
    import: "default",
});
let outlines = import.meta.glob<CompiledHeading[]>(
    [
        "./docs/guides/*.{md,mdx}",
        "./docs/deploy/*.{md,mdx}",
        "./docs/package/**/*.md",
        "!./docs/*/_*",
    ],
    { base: "../../", import: "headings", query: "?outline", eager: true },
);

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

    let all = [
        ...guides.map(guide =>
            document(authored("guides", guide.id), {
                ...page(`/guides/${guide.id}`, "guides", guide.data),
                ...variant(guide.id, guide.data.build, guideIds),
            }),
        ),
        ...deploy.map(entry =>
            document(
                authored("deploy", entry.id),
                page(`/deploy/${entry.id}`, "deploy", entry.data),
            ),
        ),
        ...api.map(entry =>
            document(
                `./${entry.data.source}`,
                {
                    ...page(entry.data.url, "api", entry.data),
                    module: entry.data.module,
                    kind: entry.data.kind,
                },
                entry.data.aliases,
            ),
        ),
    ];

    return {
        all,
        pages: all.map(({ page }) => page),
        byUrl: new Map(all.map(document => [document.page.url, document])),
        canonical: new Map(all.map(({ page }) => [page.url.replace(/\/$/, ""), page.url])),
    };
}

/** The body key of an authored page, which may be Markdown or MDX. */
function authored(section: "guides" | "deploy", id: string): string {
    let key = [`./docs/${section}/${id}.mdx`, `./docs/${section}/${id}.md`].find(
        candidate => candidate in components,
    );
    if (!key) throw new Error(`docs/${section}/${id} has no compiled body.`);
    return key;
}

function document(
    key: string,
    metadata: Omit<DocumentPage, "headings">,
    aliases: Alias[] = [],
): Document {
    let body = bodyOf(key);
    let compiled = outlines[key];
    if (!body || !compiled)
        throw new Error(`${metadata.url} has no compiled body at ${key.slice(2)}.`);
    return {
        page: { ...metadata, headings: outline(metadata, compiled, key.slice(2)) },
        aliases,
        body,
    };
}

/**
 * A body ready for its article: an authored component rendered, or a
 * reference page's prepared HTML inserted as it is.
 */
function bodyOf(key: string): (() => Promise<RemixNode>) | undefined {
    let component = components[key];
    if (component) return async () => (await component())({});
    let reference = references[key];
    if (reference) return async () => createElement("div", { innerHTML: await reference() });
    return undefined;
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
    return { buildMode: mode, counterpart: `/guides/${sibling}` };
}
