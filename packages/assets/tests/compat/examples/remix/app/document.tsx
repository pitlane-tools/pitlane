import type { Handle, RemixNode } from "remix/component";
import { ImportMap } from "remix/component/server";

import { scriptEntry, stylesheetHref, stylesheets } from "./assets.ts";

export interface DocumentProps {
    children?: RemixNode;
    pathname: string;
}

// The remix CLI template's document plus stylesheet links and the upstream
// example's navigation.
export function Document(handle: Handle<DocumentProps>) {
    return () => {
        let { children, pathname } = handle.props;
        let { href, importMap, preloads } = scriptEntry;

        return (
            <html lang="en">
                <head>
                    <meta charSet="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <title>Island Framework</title>
                    <link rel="stylesheet" href={stylesheetHref} />
                    {stylesheets.map(stylesheet => (
                        <link key={stylesheet} rel="stylesheet" href={stylesheet} />
                    ))}
                    <ImportMap value={importMap} />
                    {preloads.map(preloadHref => (
                        <link key={preloadHref} rel="modulepreload" href={preloadHref} />
                    ))}
                    <script type="module" src={href} />
                </head>
                <body>
                    <nav>
                        <ul>
                            <li>
                                <a href="/" className={pathname === "/" ? "active" : undefined}>
                                    Home
                                </a>
                            </li>
                            <li>
                                <a href="/about" className={pathname === "/about" ? "active" : undefined}>
                                    About
                                </a>
                            </li>
                            <li>
                                <a href="/books" className={pathname === "/books" ? "active" : undefined}>
                                    Books
                                </a>
                            </li>
                        </ul>
                    </nav>
                    {children}
                </body>
            </html>
        );
    };
}
