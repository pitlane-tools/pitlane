import { css } from "@pitlane/theme";
import { type Handle, type RemixNode } from "remix/component";

import { stylesheetHref, stylesheets } from "#/assets.ts";
import { t, Theme } from "#/theme.ts";

export interface DocumentProps {
    children?: RemixNode;
}

export function Document(handle: Handle<DocumentProps>) {
    return () => {
        let { children } = handle.props;

        return (
            <html
                lang="en"
                mix={css({
                    // No hand-written dark-mode media query needed: the vars
                    // installed by <Theme /> flip with prefers-color-scheme.
                    backgroundColor: t.color.surface,
                    color: t.color.text,
                    fontFamily: t.font.sans,
                })}
            >
                <head>
                    <meta charSet="utf-8" />
                    <meta content="width=device-width, initial-scale=1" name="viewport" />
                    <title>@pitlane/theme demo</title>

                    <link href="/favicon.svg" rel="icon" type="image/svg+xml" />

                    {/* Install the design-token CSS variables once. */}
                    <Theme />

                    <link href={stylesheetHref} rel="stylesheet" />
                    {stylesheets.map(stylesheet => (
                        <link href={stylesheet} key={stylesheet} rel="stylesheet" />
                    ))}
                </head>
                <body>{children}</body>
            </html>
        );
    };
}
