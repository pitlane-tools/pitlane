import type { Handle } from "remix/component";

import { Frame } from "remix/component";
import { ImportMap } from "remix/component/server";

import "./styles.css";
import { scriptEntry, stylesheets } from "./assets.ts";
import { Counter } from "./counter.tsx";
import { routes } from "./routes.ts";

export function Document(handle: Handle<{ hasEnv: boolean; userAgent: string; pathname: string }>) {
    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <title>Cloudflare fixture</title>
                {stylesheets.map(href => (
                    <link href={href} key={href} rel="stylesheet" />
                ))}
                <ImportMap value={scriptEntry.importMap} />
                {scriptEntry.preloads.map(href => (
                    <link href={href} key={href} rel="modulepreload" />
                ))}
                <script async src={scriptEntry.href} type="module" />
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
