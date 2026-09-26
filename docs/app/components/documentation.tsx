import type { Handle, RemixNode } from "remix/ui";

import { tva } from "@pitlane/theme";

import type { Preferences } from "../document.ts";

import { t } from "../theme.ts";
import { Article } from "./article.tsx";

/**
 * A compiled MDX document: a plain function of props, which is what an
 * `import doc from "./doc.mdx"` binding is. It is not a Remix component, so a
 * page renders one through {@link Include} rather than as `<doc />`.
 */
export type MdxDocument = (props: Record<string, never>) => RemixNode;

/** Renders a shared partial inside the page that includes it. */
export function Include(handle: Handle<{ document: MdxDocument }>) {
    return () => handle.props.document({});
}

/** The page a documentation component is rendered in, or an error naming the component. */
function articleOf<Props>(handle: Handle<Props>, component: string) {
    let article = handle.context.get(Article);
    if (!article) throw new Error(`<${component}> is rendered outside a documentation article.`);
    return article;
}

export type CalloutKind = "tip" | "info" | "warning" | "danger";

const CALLOUT_LABELS: Record<CalloutKind, string> = {
    tip: "TIP",
    info: "INFO",
    warning: "WARNING",
    danger: "DANGER",
};

let callout = tva({
    base: {
        margin: [0, 0, t.spacing(4)],
        padding: [t.spacing(3.5), t.spacing(4)],
        border: `${t.size.hairline} solid`,
        borderRadius: t.radius.md,
        fontSize: t.text.md,
        "& > :first-child": { margin: [0, 0, t.spacing(1.5)], fontWeight: t.weight.semibold },
        "& > :last-child": { marginBottom: 0 },
        "& :not(pre) > code": { backgroundColor: t.color.raised },
    },
    variants: {
        kind: {
            info: {
                backgroundColor: t.color.callout.info.background,
                borderColor: t.color.callout.info.border,
                "& > :first-child": { color: t.color.callout.info.title },
            },
            tip: {
                backgroundColor: t.color.callout.tip.background,
                borderColor: t.color.callout.tip.border,
                "& > :first-child": { color: t.color.callout.tip.title },
            },
            warning: {
                backgroundColor: t.color.callout.warning.background,
                borderColor: t.color.callout.warning.border,
                "& > :first-child": { color: t.color.callout.warning.title },
            },
            danger: {
                backgroundColor: t.color.callout.danger.background,
                borderColor: t.color.callout.danger.border,
                "& > :first-child": { color: t.color.callout.danger.title },
            },
        },
    },
});

let calloutStyles = {
    tip: callout<HTMLElement>({ kind: "tip" }),
    info: callout<HTMLElement>({ kind: "info" }),
    warning: callout<HTMLElement>({ kind: "warning" }),
    danger: callout<HTMLElement>({ kind: "danger" }),
};

export interface CalloutProps {
    kind: CalloutKind;
    /** Shown in place of the kind's own label. */
    title?: RemixNode;
    children?: RemixNode;
}

/** An aside the prose sets apart: a tip, a note, a warning, or a danger. */
export function Callout(handle: Handle<CalloutProps>) {
    return () => (
        <aside data-callout={handle.props.kind} mix={calloutStyles[handle.props.kind]}>
            <p>{handle.props.title ?? CALLOUT_LABELS[handle.props.kind]}</p>
            {handle.props.children}
        </aside>
    );
}

/** The part of a guide that applies only to an application built with Vite. */
export function Vite(handle: Handle<{ children?: RemixNode }>) {
    return variant(handle, "vite", "Vite");
}

/** The part of a guide that applies only to an application with no bundler. */
export function NoBuild(handle: Handle<{ children?: RemixNode }>) {
    return variant(handle, "no-build", "NoBuild");
}

/** A section kept on the page for its setup, named by the page's `build:` frontmatter, and dropped on the other. */
function variant(
    handle: Handle<{ children?: RemixNode }>,
    mode: Preferences["buildMode"],
    tag: string,
) {
    let { page } = articleOf(handle, tag);
    if (!page.buildMode) {
        throw new Error(
            `A <${tag}> section is rendered on ${page.url}, which declares no "build:" in its ` +
                `frontmatter, so it would be dropped without a word. Add "build: vite" or ` +
                `"build: no-build".`,
        );
    }
    return () => (page.buildMode === mode ? handle.props.children : null);
}

// A document awaits `installAlternatives()` from `app/install.ts` at module
// scope and passes the result: highlighting is asynchronous, rendering is not.
export { InstallGroup } from "./install-group.tsx";
