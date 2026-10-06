import { scriptEntry } from "./assets.ts";

/**
 * The document every navigable route answers with. Nothing in it renders app
 * UI: the browser entry mounts into `#app` and takes over from there. The
 * resolver names the built chunk after a build, and the dev URL before one.
 */
export function Shell() {
    return () => (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <title>Client rendered</title>
                <script src={scriptEntry.href} type="module" />
            </head>
            <body>
                <div id="app" />
            </body>
        </html>
    );
}
