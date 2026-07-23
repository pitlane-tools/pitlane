import type { Handle } from "remix/ui";

import "./styles.css";

import { mergeAssets } from "../../../../src/runtime.ts";
import { Counter } from "./counter.tsx";
// @ts-expect-error - ?assets= imports are typed by @pitlane/dev/assets in real apps
import clientAssets from "./entry.browser.ts?assets=client";
// @ts-expect-error - ?assets= imports are typed by @pitlane/dev/assets in real apps
import serverAssets from "./entry.server.tsx?assets=ssr";

export function Document(handle: Handle<{ hasEnv: boolean; userAgent: string }>) {
    let assets = mergeAssets(clientAssets, serverAssets);

    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <title>Cloudflare fixture</title>
                {assets.css.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="stylesheet" />
                ))}
                <script async src={clientAssets.entry} type="module" />
                {assets.js.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="modulepreload" />
                ))}
            </head>
            <body>
                <h1 data-env={String(handle.props.hasEnv)}>UA: {handle.props.userAgent}</h1>
                <Counter />
            </body>
        </html>
    );
}
