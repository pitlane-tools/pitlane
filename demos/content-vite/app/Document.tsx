import { type Handle, type RemixNode } from "remix/component";

import { scriptEntry, stylesheetHref, stylesheets } from "./assets.ts";

export interface DocumentProps {
    title: string;
    children?: RemixNode;
}

export function Document(handle: Handle<DocumentProps>) {
    return () => {
        let { children, title } = handle.props;
        let { href, preloads } = scriptEntry;

        return (
            <html lang="en">
                <head>
                    <meta charSet="utf-8" />
                    <meta content="width=device-width, initial-scale=1" name="viewport" />
                    <title>{title} · prebuilt by contentLayer()</title>
                    <link href={stylesheetHref} rel="stylesheet" />
                    {stylesheets.map(stylesheet => (
                        <link href={stylesheet} key={stylesheet} rel="stylesheet" />
                    ))}
                    {/* Loads the runtime that hydrates every clientEntry component,
                        including the one the MDX post imports. */}
                    <script async src={href} type="module" />
                    {preloads.map(preload => (
                        <link href={preload} key={preload} rel="modulepreload" />
                    ))}
                </head>
                <body>{children}</body>
            </html>
        );
    };
}
