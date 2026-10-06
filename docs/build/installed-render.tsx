import { renderToStream } from "remix/component/server";

import type { DocumentPage } from "../app/document.ts";

import { Article } from "../app/components/article.tsx";
import { authoredDocuments } from "../app/documents.ts";
import { articleOf } from "./exports.ts";

/** Runs inside Vite; Article supplies the page context that documentation components require. */
export async function renderAuthored(): Promise<{ page: DocumentPage; article: string }[]> {
    return Promise.all(
        (await authoredDocuments()).map(async ({ page, body }) => {
            let stream = renderToStream(<Article page={page}>{await body()}</Article>, {
                onError(error) {
                    throw error;
                },
                // The Markdown export discards hydration metadata, so no browser bundles are needed.
                resolveClientEntry: entryId => ({ exportName: "default", href: entryId }),
            });
            let html = await new Response(stream).text();
            return { page, article: articleOf(html, page.url) };
        }),
    );
}
