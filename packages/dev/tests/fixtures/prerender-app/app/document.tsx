import type { RemixNode } from "remix/ui";

import { mergeAssets } from "@pitlane/dev/runtime";

import "./styles.css";
import { HMR } from "pitlane:dev";

import clientAssets from "./entry.browser.ts?assets=client";
import serverAssets from "./entry.server.tsx?assets=ssr";

export interface DocumentProps {
    title: string;
    children: RemixNode;
}

export function Document(handle: { props: DocumentProps }) {
    let assets = mergeAssets(clientAssets, serverAssets);

    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <title>{handle.props.title}</title>
                {assets.css.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="stylesheet" />
                ))}
                <script async src={clientAssets.entry} type="module" />
            </head>
            <body>
                <h1 data-title>{handle.props.title}</h1>
                {handle.props.children}
                <HMR />
            </body>
        </html>
    );
}
