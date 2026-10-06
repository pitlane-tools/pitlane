import "./styles.css";
import { scriptEntry, stylesheets } from "./assets.ts";
import { Counter } from "./counter.tsx";

export function Document() {
    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <title>Node fixture</title>
                {stylesheets.map(href => (
                    <link href={href} key={href} rel="stylesheet" />
                ))}
                {scriptEntry.preloads.map(href => (
                    <link href={href} key={href} rel="modulepreload" />
                ))}
                <script async src={scriptEntry.href} type="module" />
            </head>
            <body>
                <h1>Node fixture</h1>
                <Counter />
            </body>
        </html>
    );
}
