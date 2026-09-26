import type { Handle, RemixNode } from "remix/ui";

import { css, type ThemedCSSProps, tva } from "@pitlane/theme";

import type { DocumentPage } from "../document.ts";

import clientAssets from "../entry.browser.ts?assets=client";
import { eyebrow } from "../styles/controls.ts";
import {
    belowOutlineColumn,
    compact,
    medium,
    narrow,
    outlineColumn,
    wide,
} from "../styles/media.ts";
import { t, Theme } from "../theme.ts";
import { Article, prose } from "./article.tsx";
import { BuildModeSwitch } from "./build-mode-switch.tsx";
import { SectionBar, SiteHeader } from "./header.tsx";
import { MarkdownActions } from "./markdown-actions.tsx";
import { buildModeVariants, buildNavigation, PRIMARY_LINKS } from "./navigation.ts";
import { OUTLINE_ID } from "./outline.tsx";
import { DOCUMENT_NAVIGATION_ID, DocumentNavigation } from "./sidebar.tsx";
import { documentTitle, OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "./site.ts";

export interface ShellProps {
    page: DocumentPage;
    /** Every published page, for the navigation. */
    pages: DocumentPage[];
    /** The page's compiled body. */
    children?: RemixNode;
}

/**
 * A documentation page as one complete document. Every request, and every
 * soft navigation Remix reconciles, renders its metadata, navigation,
 * article, and outline together from the same page.
 */
export function Shell(handle: Handle<ShellProps>) {
    return () => {
        let { page, pages, children } = handle.props;
        let navigation = buildNavigation(pages, page);
        let variants = buildModeVariants(page);
        let hasOutline = page.headings.length > 0;
        return (
            <Document description={page.description} title={page.title} url={page.url}>
                <SiteHeader search="sidebar" section={page.section} />
                <SectionBar
                    label={navigation.label}
                    navigation={DOCUMENT_NAVIGATION_ID}
                    outline={hasOutline ? OUTLINE_ID : undefined}
                />
                <DocumentNavigation navigation={navigation} />
                <main
                    id="main-content"
                    mix={main({ layout: "docs", outline: hasOutline })}
                    tabindex={-1}
                >
                    <div mix={css(pageGrid)}>
                        <div
                            mix={css({
                                gridArea: "actions",
                                display: "flex",
                                justifyContent: "flex-end",
                                marginBottom: t.spacing(4),
                            })}
                        >
                            <MarkdownActions url={page.url} />
                        </div>
                        {page.buildMode && variants ? (
                            <BuildModeSwitch current={page.buildMode} variants={variants} />
                        ) : null}
                        <Article page={page}>{children}</Article>
                    </div>
                </main>
            </Document>
        );
    };
}

/** The 404 document, sharing the shell's header, typography, and theme. */
export function NotFound() {
    return () => (
        <Document
            description="The requested documentation page does not exist."
            title="Page not found"
        >
            <SiteHeader search="header" />
            <main id="main-content" mix={main({ layout: "standalone" })} tabindex={-1}>
                <div mix={css({ ...prose, margin: [0, "auto"], paddingTop: t.spacing(6) })}>
                    <p
                        mix={css({
                            ...eyebrow,
                            marginBottom: t.spacing(2),
                            color: t.color.accent,
                            fontSize: t.text.xs,
                        })}
                    >
                        404
                    </p>
                    <h1>Page not found</h1>
                    <p>
                        There is no documentation page at this address. It may have moved when the
                        reference was reorganized, or the link may be out of date.
                    </p>
                    <ul>
                        <li>
                            <a href={PRIMARY_LINKS.guides}>Browse the guides</a>
                        </li>
                        <li>
                            <a href={PRIMARY_LINKS.api}>Browse the API reference</a>
                        </li>
                    </ul>
                </div>
            </main>
        </Document>
    );
}

let main = tva({
    base: {
        display: "block",
        minHeight: t.size.belowHeader,
        marginTop: t.size.header,
        padding: t.spacing(13),
        backgroundColor: t.color.surface,
        outline: "none",
        [narrow]: { padding: [t.spacing(8), t.spacing(6), t.spacing(16)] },
        [compact]: { padding: [t.spacing(6), t.spacing(4), t.spacing(14)] },
    },
    variants: {
        layout: {
            docs: {
                marginInlineStart: t.size.panelStart,
                borderRadius: [t.radius.panel, 0, 0, t.radius.panel],
                // The panel scrolls under the fixed header, taking its rounded
                // corner along; this redraws the corner where the header ends.
                "&::before": {
                    content: '""',
                    position: "fixed",
                    top: t.size.header,
                    left: t.size.panelStart,
                    width: t.radius.panel,
                    height: t.radius.panel,
                    background: `radial-gradient(circle at 100% 100%, transparent calc(${t.radius.panel} - 0.5px), ${t.color.canvas} ${t.radius.panel})`,
                    pointerEvents: "none",
                },
                [narrow]: {
                    marginInlineStart: 0,
                    marginTop: t.size.barsHeight,
                    minHeight: t.size.belowBars,
                    borderRadius: 0,
                    "&::before": { display: "none" },
                },
            },
            standalone: {},
        },
        /**
         * The section bar carries the outline's disclosure until the outline
         * has a column. Between the breakpoints it overlays the top of the
         * article panel, which makes room for it.
         */
        outline: {
            true: { [medium]: { paddingTop: t.size.belowSectionBar } },
        },
    },
});

let pageGrid: ThemedCSSProps = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateAreas: '"actions" "switch" "body"',
    columnGap: t.spacing(10),
    maxWidth: t.size.content,
    [outlineColumn]: {
        gridTemplateColumns: `minmax(0, 1fr) ${t.size.toc}`,
        gridTemplateAreas: '"actions outline" "switch outline" "body outline"',
        gridTemplateRows: "auto auto 1fr",
    },
};

interface DocumentProps {
    title: string;
    description: string;
    /** Public path of the page; the 404 document has no canonical address. */
    url?: string;
    children: RemixNode;
}

/**
 * The `<html>` every page shares. Every theme color is a `light-dark()` pair
 * and `<Theme />` sets `color-scheme: light dark` on `:root`, so the operating
 * system's color scheme decides the appearance, from the first paint and as
 * it changes, with or without a script.
 */
function Document(handle: Handle<DocumentProps>) {
    return () => {
        let { title, description, url, children } = handle.props;
        let fullTitle = documentTitle(title);
        let canonical = url ? `${SITE_URL}${url}` : undefined;
        return (
            <html lang="en" mix={css(root)}>
                <head>
                    <meta charset="utf-8" />
                    <meta content="width=device-width, initial-scale=1" name="viewport" />
                    <title>{fullTitle}</title>
                    <meta content={description} name="description" />
                    {canonical ? <link href={canonical} rel="canonical" /> : null}
                    <meta content={SITE_NAME} property="og:site_name" />
                    <meta content="website" property="og:type" />
                    <meta content={fullTitle} property="og:title" />
                    <meta content={description} property="og:description" />
                    {canonical ? <meta content={canonical} property="og:url" /> : null}
                    <meta content={OG_IMAGE} property="og:image" />
                    <meta content="2508" property="og:image:width" />
                    <meta content="1627" property="og:image:height" />
                    <meta content={`${SITE_NAME} — ${SITE_DESCRIPTION}`} property="og:image:alt" />
                    <meta content="summary_large_image" name="twitter:card" />
                    <meta content={fullTitle} name="twitter:title" />
                    <meta content={description} name="twitter:description" />
                    <meta content={OG_IMAGE} name="twitter:image" />
                    <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
                    <Theme />
                    {clientAssets.css.map(attrs => (
                        <link key={attrs.href} {...attrs} rel="stylesheet" />
                    ))}
                    <script async src={clientAssets.entry} type="module" />
                    {clientAssets.js.map(attrs => (
                        <link key={attrs.href} {...attrs} rel="modulepreload" />
                    ))}
                </head>
                <body mix={css({ margin: 0 })}>
                    <a href="#main-content" mix={css(skipLink)}>
                        Skip to content
                    </a>
                    {children}
                </body>
            </html>
        );
    };
}

/** Document-wide defaults, set once on the root and overridden by the components below it. */
let root: ThemedCSSProps = {
    backgroundColor: t.color.canvas,
    color: t.color.text,
    fontFamily: t.font.sans,
    fontSize: t.text.base,
    lineHeight: t.text.leading.normal,
    // csstype's WebkitFontSmoothing omits the `antialiased` keyword WebKit and
    // Blink actually implement.
    "-webkit-font-smoothing": "antialiased",
    WebkitTextSizeAdjust: "100%",
    textSizeAdjust: "100%",
    scrollPaddingTop: t.size.anchorOffset,
    scrollbarColor: `${t.color.control} transparent`,
    scrollbarWidth: "thin",
    [belowOutlineColumn]: { scrollPaddingTop: t.size.anchorOffsetBars },
    // The sidebar toggle collapses the column; the panel and its chrome follow this offset.
    "&[data-nav-collapsed]": {
        [wide]: {
            "--docs-panel-start": t.size.gutter,
            "--docs-reclaimed": `calc(${t.size.sidebar} + ${t.size.gutter})`,
        },
    },
    "&, & *, & ::before, & ::after": { boxSizing: "border-box" },
    "& ::selection": { backgroundColor: t.color.selection, color: t.color.selectionText },
    "& :focus-visible": {
        outline: `${t.size.focus} solid ${t.color.link}`,
        outlineOffset: t.size.focus,
    },
    "& :where(button, input, select, textarea)": { font: "inherit", color: "inherit" },
    // Every monospace run, including elements no component styles, sets in
    // JetBrains Mono with its programming ligatures.
    "& :where(code, kbd, pre, samp)": {
        fontFamily: t.font.mono,
        fontVariantLigatures: "common-ligatures contextual",
    },
};

let skipLink: ThemedCSSProps = {
    position: "fixed",
    insetBlockStart: t.spacing(2),
    insetInlineStart: t.spacing(2),
    zIndex: t.layer.skip,
    padding: [t.spacing(2), t.spacing(3)],
    borderRadius: t.radius.md,
    backgroundColor: t.color.raised,
    color: t.color.text,
    transform: "translateY(calc(-100% - 1rem))",
    // Its shadow would reach into the header while the link waits off screen.
    "&:focus": { transform: "none", boxShadow: t.shadow.lg },
};
