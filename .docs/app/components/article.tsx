import type { Handle, RemixNode } from "remix/ui";

import { css, type ThemedCSSProps } from "@pitlane/theme";

import type { DocumentPage } from "../document.ts";

import { collapse } from "../styles/controls.ts";
import { t } from "../theme.ts";
import { Outline } from "./outline.tsx";

export interface ArticleProps {
    page: DocumentPage;
    /** The page's compiled body. */
    children?: RemixNode;
}

/** What the documentation components inside a body read from their page. */
export interface ArticleContext {
    page: DocumentPage;
}

let headingAnchor: ThemedCSSProps = {
    marginInlineStart: t.spacing(2),
    color: t.color.link,
    fontWeight: t.weight.regular,
    textDecoration: "none",
    opacity: 0,
    transition: `opacity ${t.duration.fast} ${t.ease.standard}`,
    "&::before": { content: '"#"' },
    "&:focus-visible": { opacity: 1 },
};

/**
 * Typography for compiled Markdown, which arrives as native elements. The
 * heading permalinks are the one generated class. `pre` belongs to the code
 * components, so the inline-code rule leaves it alone.
 */
export const prose: ThemedCSSProps = {
    minWidth: 0,
    maxWidth: t.size.prose,
    transition: `max-width ${collapse}`,
    fontSize: t.text.base,
    lineHeight: t.text.leading.normal,
    overflowWrap: "break-word",
    "& > :first-child": { marginTop: 0 },
    "& :where(h1, h2, h3, h4, h5, h6)": { overflowWrap: "anywhere" },
    "& :where(h1, h2, h3, h4, h5, h6):hover .doc-heading__anchor": { opacity: 1 },
    "& h1": {
        margin: [0, 0, t.spacing(6)],
        fontSize: t.text.display,
        fontWeight: t.weight.bold,
        letterSpacing: t.tracking.tight,
        lineHeight: t.text.leading.tight,
        textWrap: "balance",
    },
    "& h2": {
        margin: [t.spacing(10), 0, t.spacing(4)],
        fontSize: t.text.xl,
        fontWeight: t.weight.bold,
        letterSpacing: t.tracking.tighter,
        lineHeight: t.text.leading.tight,
    },
    "& h3": {
        margin: [t.spacing(8), 0, t.spacing(3)],
        fontSize: t.text.lg,
        fontWeight: t.weight.semibold,
        lineHeight: t.text.leading.snug,
    },
    "& :where(h4, h5, h6)": {
        margin: [t.spacing(6), 0, t.spacing(2)],
        fontSize: t.text.base,
        fontWeight: t.weight.semibold,
        lineHeight: t.text.leading.compact,
    },
    "& .doc-heading__anchor": headingAnchor,
    "& :where(p, ul, ol, dl, blockquote, table, figure)": { margin: [0, 0, t.spacing(4)] },
    "& :where(ul, ol)": { paddingInlineStart: t.spacing(6) },
    "& li + li": { marginTop: t.spacing(1) },
    "& li > p": { marginBottom: t.spacing(2) },
    "& a:not(.doc-heading__anchor)": {
        color: t.color.link,
        textDecorationLine: "underline",
        textDecorationColor: t.color.linkUnderline,
        textDecorationThickness: t.size.hairline,
        textUnderlineOffset: t.spacing(1),
        "&:hover": { color: t.color.linkHover, textDecorationColor: t.color.linkHover },
    },
    "& a code": { color: "inherit" },
    "& blockquote": {
        marginInline: 0,
        padding: [t.spacing(1), 0, t.spacing(1), t.spacing(4)],
        borderInlineStart: `${t.size.hairline} solid ${t.color.control}`,
        color: t.color.secondary,
    },
    "& hr": {
        margin: [t.spacing(8), 0],
        border: 0,
        borderTop: `${t.size.hairline} solid ${t.color.border}`,
    },
    "& :where(img, video)": { maxWidth: t.size.full, height: "auto" },
    "& :where(strong, b)": { fontWeight: t.weight.semibold },
    // Wide tables scroll inside the column rather than widening the page.
    "& table": {
        display: "block",
        width: t.size.full,
        maxWidth: "max-content",
        borderCollapse: "collapse",
        overflowX: "auto",
        fontSize: t.text.md,
    },
    "& :where(th, td)": {
        padding: [t.spacing(2), t.spacing(3)],
        border: `${t.size.hairline} solid ${t.color.border}`,
        textAlign: "start",
        verticalAlign: "top",
    },
    "& th": { backgroundColor: t.color.subtle, fontWeight: t.weight.semibold },
    "& :where(.expressive-code)": { margin: [0, 0, t.spacing(4)] },
    "& :not(pre) > code": {
        padding: [t.spacing(0.5), t.spacing(1.5)],
        border: `${t.size.hairline} solid ${t.color.border}`,
        borderRadius: t.radius.sm,
        backgroundColor: t.color.subtle,
        fontFamily: t.font.mono,
        fontSize: t.text.code,
    },
    "& kbd": {
        padding: [0, t.spacing(1)],
        border: `${t.size.hairline} solid ${t.color.border}`,
        borderRadius: t.radius.sm,
        backgroundColor: t.color.raised,
        fontFamily: t.font.mono,
        fontSize: t.text.xs,
    },
};

/**
 * A page's body and its outline. It provides the page to the documentation
 * components inside the body, so a two-setup guide renders its own setup's
 * sections.
 */
export function Article(handle: Handle<ArticleProps, ArticleContext>) {
    return () => {
        let { page, children } = handle.props;
        handle.context.set({ page });
        return (
            <>
                <article mix={css({ ...prose, gridArea: "body" })}>{children}</article>
                {page.headings.length > 0 ? <Outline headings={page.headings} /> : null}
            </>
        );
    };
}
