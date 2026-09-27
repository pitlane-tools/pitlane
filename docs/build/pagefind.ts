import * as pagefind from "pagefind";

import type { DocumentPage } from "../app/document.ts";

/** What the index records for one page: its canonical URL and its article. */
export interface SearchDocument {
    page: DocumentPage;
    /** The page's rendered `<article>`. */
    article: string;
    /** Other public names the same declaration is exported under. */
    aliases: { module: string; name: string }[];
}

const SECTION_LABELS: Record<DocumentPage["section"], string> = {
    guides: "Guides",
    deploy: "Deploy",
    api: "API",
};

/**
 * Writes the browser search index: one record per published page, keyed by
 * its public URL rather than the frame it was rendered from, carrying the
 * section, module, and kind a result needs to say what it is.
 *
 * Alias names ride along on the canonical record, so a re-exported symbol is
 * found under every public name and leads to its one page.
 */
export async function writeSearchIndex(
    documents: SearchDocument[],
    outputPath: string,
): Promise<void> {
    let { index, errors } = await pagefind.createIndex({});
    if (!index) throw new Error(`Pagefind could not create an index: ${errors.join("; ")}`);

    for (let document of documents) {
        let added = await index.addHTMLFile({ url: document.page.url, content: record(document) });
        if (added.errors.length > 0) {
            throw new Error(`Pagefind rejected ${document.page.url}: ${added.errors.join("; ")}`);
        }
    }

    let written = await index.writeFiles({ outputPath });
    if (written.errors.length > 0)
        throw new Error(`Pagefind could not write: ${written.errors.join("; ")}`);
    await pagefind.close();
}

function record({ page, article, aliases }: SearchDocument): string {
    let meta = [
        `<p data-pagefind-meta="title" data-pagefind-weight="10">${escape(page.title)}</p>`,
    ];
    let filters = [`section:${SECTION_LABELS[page.section]}`];
    if (page.module) {
        meta.push(`<p data-pagefind-meta="module">${escape(page.module)}</p>`);
        filters.push(`module:${page.module}`);
    }
    if (page.kind) meta.push(`<p data-pagefind-meta="kind">${escape(page.kind)}</p>`);
    let names = aliases.map(
        alias =>
            `<p data-pagefind-weight="8">${escape(alias.name)} from ${escape(alias.module)}</p>`,
    );

    return (
        `<!doctype html><html lang="en"><head><title>${escape(page.title)}</title></head>` +
        `<body data-pagefind-body data-pagefind-filter="${escape(filters.join(", "))}" ` +
        `data-pagefind-meta="section:${SECTION_LABELS[page.section]}">` +
        `${meta.join("")}${article}${names.join("")}</body></html>`
    );
}

function escape(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
