import type { RemixNode } from "remix/component";

import { ImportMap } from "remix/component/server";

import "./styles.css";
import { scriptEntry, stylesheets } from "./assets.ts";

export interface DocumentProps {
    title: string;
    children: RemixNode;
}

export function Document(handle: { props: DocumentProps }) {
    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <title>{handle.props.title}</title>
                {stylesheets.map(href => (
                    <link href={href} key={href} rel="stylesheet" />
                ))}
                <ImportMap value={scriptEntry.importMap} />
                <script async src={scriptEntry.href} type="module" />
            </head>
            <body>
                <h1 data-title>{handle.props.title}</h1>
                {handle.props.children}
            </body>
        </html>
    );
}
