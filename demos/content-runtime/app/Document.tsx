import type { Handle, RemixNode } from "remix/ui";

import { ImportMap } from "remix/ui/server";

import { getAssetEntry } from "#/middleware/asset-entry.ts";

export interface DocumentProps {
    title: string;
    children?: RemixNode;
}

/**
 * No bundler runs here, so the browser assets come from `remix/assets`.
 *
 * The import map is what lets a served module keep its bare `remix/ui`
 * specifier: the asset server compiles TypeScript and JSX but does not rewrite
 * package imports. This one covers the hydration runtime. Each `clientEntry`
 * component the page renders contributes its own, which the renderer emits as
 * it meets them.
 */
export function Document(handle: Handle<DocumentProps>) {
    return () => {
        let { children, title } = handle.props;
        let { scriptEntry, stylesheetHref } = getAssetEntry();
        let { href, importMap, preloads } = scriptEntry;

        return (
            <html lang="en">
                <head>
                    <meta charSet="utf-8" />
                    <meta content="width=device-width, initial-scale=1" name="viewport" />
                    <title>{title} · no bundler</title>
                    <link href={stylesheetHref} rel="stylesheet" />
                    <ImportMap value={importMap} />
                    {preloads.map(preloadHref => (
                        <link href={preloadHref} key={preloadHref} rel="modulepreload" />
                    ))}
                    <script src={href} type="module" />
                </head>
                <body>{children}</body>
            </html>
        );
    };
}
