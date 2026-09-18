import { type Handle, type RemixNode } from "remix/ui";
import { ImportMap } from "remix/ui/server";

import { browserAssets } from "#/entry.server.tsx";

export interface DocumentProps {
    title: string;
    children?: RemixNode;
}

/**
 * No bundler runs here, so every browser asset comes from `remix/assets`: the
 * stylesheet, the hydration runtime, and the modules `clientEntry` components
 * are loaded from.
 *
 * `<ImportMap>` is what lets those served modules keep their bare `remix/ui`
 * specifiers — the asset server compiles TypeScript and JSX but does not
 * rewrite package imports. The renderer merges the maps of whichever client
 * entries the page used into this one.
 */
export function Document(handle: Handle<DocumentProps>) {
    let { hydration, importMap, styles } = browserAssets;

    return () => {
        let { children, title } = handle.props;

        return (
            <html lang="en">
                <head>
                    <meta charSet="utf-8" />
                    <meta content="width=device-width, initial-scale=1" name="viewport" />
                    <title>{title} · no bundler</title>
                    <ImportMap value={importMap} />
                    <link href={styles} rel="stylesheet" />
                    <script async src={hydration.href} type="module" />
                    {hydration.preloads.map(href => (
                        <link href={href} key={href} rel="modulepreload" />
                    ))}
                </head>
                <body>{children}</body>
            </html>
        );
    };
}
