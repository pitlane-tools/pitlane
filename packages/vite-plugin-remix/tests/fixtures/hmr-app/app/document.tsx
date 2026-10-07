import { ImportMap } from "remix/component/server";

import "./styles.css";
import { ArrowCounter } from "./arrow-counter.tsx";
import { scriptEntry, stylesheets } from "./assets.ts";
import { FnCounter } from "./fn-counter.tsx";

export function Document() {
    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <title>HMR fixture</title>
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
                <h1 data-h1>Server heading A</h1>
                <FnCounter />
                <ArrowCounter />
            </body>
        </html>
    );
}
