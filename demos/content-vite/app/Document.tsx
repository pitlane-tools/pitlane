import { mergeAssets } from "@hiogawa/vite-plugin-fullstack/runtime";
import { type Handle, type RemixNode } from "remix/ui";

import serverAssets from "./entry.server.tsx?assets=ssr";
import styles from "./index.css?url";

export interface DocumentProps {
    title: string;
    children?: RemixNode;
}

export function Document(handle: Handle<DocumentProps>) {
    let assets = mergeAssets(serverAssets);

    return () => {
        let { children, title } = handle.props;

        return (
            <html lang="en">
                <head>
                    <meta charSet="utf-8" />
                    <meta content="width=device-width, initial-scale=1" name="viewport" />
                    <title>{title} · prebuilt by content()</title>
                    <link href={styles} rel="stylesheet" />
                    {assets.css.map(attrs => (
                        <link key={attrs.href} {...attrs} rel="stylesheet" />
                    ))}
                </head>
                <body>{children}</body>
            </html>
        );
    };
}
