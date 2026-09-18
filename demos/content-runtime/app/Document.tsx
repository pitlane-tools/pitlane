import { type Handle, type RemixNode } from "remix/ui";

export interface DocumentProps {
    title: string;
    children?: RemixNode;
}

/**
 * No bundler runs here, so the stylesheet is served by `remix/assets` from the
 * source tree rather than emitted by a build.
 */
export function Document(handle: Handle<DocumentProps>) {
    return () => {
        let { children, title } = handle.props;

        return (
            <html lang="en">
                <head>
                    <meta charSet="utf-8" />
                    <meta content="width=device-width, initial-scale=1" name="viewport" />
                    <title>{title} · no bundler</title>
                    <link href="/assets/app/public/index.css" rel="stylesheet" />
                </head>
                <body>{children}</body>
            </html>
        );
    };
}
