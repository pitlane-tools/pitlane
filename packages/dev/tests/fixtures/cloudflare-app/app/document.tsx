import type { Handle } from "remix/ui";

import { Frame } from "remix/ui";

import "./styles.css";
import { mergeAssets } from "../../../../src/runtime.ts";
import { Counter } from "./counter.tsx";
import clientAssets from "./entry.browser.ts?assets=client";
import serverAssets from "./entry.server.tsx?assets=ssr";
import { routes } from "./routes.ts";

export function Document(handle: Handle<{ hasEnv: boolean; userAgent: string; pathname: string }>) {
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
                <header>
                    <a data-rmx-target="main" href={routes.home.href()}>
                        Home
                    </a>
                    <a data-rmx-target="main" href={routes.page.href()}>
                        Page
                    </a>
                </header>
                <h1 data-env={String(handle.props.hasEnv)}>UA: {handle.props.userAgent}</h1>
                <Counter />
                <main id="main-content">
                    <Frame name="main" src={handle.props.pathname} />
                </main>
                <footer>Cloudflare fixture footer</footer>
            </body>
        </html>
    );
}
