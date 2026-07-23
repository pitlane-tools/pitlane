import "./styles.css";

import { mergeAssets } from "../../../../src/runtime.ts";
import { Counter } from "./counter.tsx";
// @ts-expect-error - ?assets= imports are typed by @pitlane/dev/assets in real apps
import clientAssets from "./entry.browser.ts?assets=client";
// @ts-expect-error - ?assets= imports are typed by @pitlane/dev/assets in real apps
import serverAssets from "./entry.server.tsx?assets=ssr";

export function Document() {
    let assets = mergeAssets(clientAssets, serverAssets);

    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <title>Node fixture</title>
                {assets.css.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="stylesheet" />
                ))}
                <script async src={clientAssets.entry} type="module" />
                {assets.js.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="modulepreload" />
                ))}
            </head>
            <body>
                <h1>Node fixture</h1>
                <Counter />
            </body>
        </html>
    );
}
