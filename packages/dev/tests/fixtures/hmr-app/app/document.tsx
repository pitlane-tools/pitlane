import "./styles.css";
import { mergeAssets } from "../../../../src/runtime.ts";
import { ArrowCounter } from "./arrow-counter.tsx";
import clientAssets from "./entry.browser.ts?assets=client";
import serverAssets from "./entry.server.tsx?assets=ssr";
import { FnCounter } from "./fn-counter.tsx";

export function Document() {
    let assets = mergeAssets(clientAssets, serverAssets);

    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <title>HMR fixture</title>
                {assets.css.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="stylesheet" />
                ))}
                <script async src={clientAssets.entry} type="module" />
                {assets.js.map(attrs => (
                    <link key={attrs.href} {...attrs} rel="modulepreload" />
                ))}
            </head>
            <body>
                <h1 data-h1>Server heading A</h1>
                <FnCounter />
                <ArrowCounter />
            </body>
        </html>
    );
}
