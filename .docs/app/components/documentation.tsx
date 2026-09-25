import type { Handle, RemixNode } from "remix/ui";

import { combine, css, tva } from "@pitlane/theme";

import { PREFERENCE_CHOICES, type Preferences } from "../document.ts";
import { control } from "../styles/controls.ts";
import { t } from "../theme.ts";
import { Article } from "./article.tsx";
import { CopyButton, codeSurface } from "./code-block.tsx";

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

/** Every package manager an install group offers, in the order its buttons show. */
const PACKAGE_MANAGERS = PREFERENCE_CHOICES.packageManager;

type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export interface InstallProps {
    /** Runtime dependencies. */
    packages?: string[];
    /** Development dependencies, installed with `-D`. */
    dev?: string[];
}

/**
 * The `add` lines that install `packages`, then `dev` with `-D`, with one
 * manager. Deno reaches npm packages through `npm:` specifiers.
 */
function installLines(manager: PackageManager, packages: string[], dev: string[]) {
    let specifier = (name: string) => (manager === "deno" ? `npm:${name}` : name);
    return [
        { flag: undefined, names: packages },
        { flag: "-D", names: dev },
    ]
        .filter(line => line.names.length > 0)
        .map(line => ({ manager, flag: line.flag, names: line.names.map(specifier) }));
}

/**
 * The install command for a set of packages, one alternative per package
 * manager. The server renders every alternative and shows the reader's chosen
 * manager, so the first response is already right. Choosing another manager
 * is an ordinary form submission that persists the choice.
 */
export function Install(handle: Handle<InstallProps>) {
    return () => {
        let { page, preferences } = articleOf(handle, "Install");
        let { packages = [], dev = [] } = handle.props;
        if (packages.length === 0 && dev.length === 0) {
            throw new Error(`<Install> on ${page.url} names no packages.`);
        }
        let selected = preferences.packageManager;
        return (
            <div
                data-code-group
                mix={css({
                    margin: [0, 0, t.spacing(4)],
                    border: `${t.size.hairline} solid ${t.color.border}`,
                    borderRadius: t.radius.md,
                    backgroundColor: t.color.code.background,
                    overflow: "hidden",
                })}
            >
                <form
                    action="/preferences"
                    data-pagefind-ignore
                    data-rmx-history="replace"
                    data-rmx-reset-scroll="false"
                    method="post"
                    mix={css({
                        margin: 0,
                        padding: [t.spacing(1), t.spacing(2), 0],
                        borderBottom: `${t.size.hairline} solid ${t.color.border}`,
                        backgroundColor: t.color.subtle,
                    })}
                >
                    <input name="preference" type="hidden" value="packageManager" />
                    <input name="returnTo" type="hidden" value={page.url} />
                    <div
                        aria-label="Package manager"
                        mix={css({ display: "flex", flexWrap: "wrap", gap: t.spacing(0.5) })}
                        role="group"
                    >
                        {PACKAGE_MANAGERS.map(manager => (
                            <button
                                aria-pressed={manager === selected ? "true" : "false"}
                                mix={managerButtonStyle}
                                name="value"
                                type="submit"
                                value={manager}
                            >
                                {manager}
                            </button>
                        ))}
                    </div>
                </form>
                <div
                    mix={css({
                        position: "relative",
                        "& pre": { ...codeSurface, border: 0, borderRadius: 0 },
                    })}
                >
                    {PACKAGE_MANAGERS.map(manager => (
                        <div data-manager={manager} hidden={manager !== selected}>
                            <pre data-language="sh">
                                <code>
                                    {installLines(manager, packages, dev).map((line, index) => (
                                        <>
                                            {index > 0 ? "\n" : null}
                                            <span mix={commandStyle}>{line.manager}</span>
                                            {" add "}
                                            {line.flag ? (
                                                <span mix={flagStyle}>{`${line.flag} `}</span>
                                            ) : null}
                                            {line.names.join(" ")}
                                        </>
                                    ))}
                                </code>
                            </pre>
                        </div>
                    ))}
                    <CopyButton
                        code={installLines(selected, packages, dev)
                            .map(line =>
                                [line.manager, "add", line.flag, ...line.names]
                                    .filter(Boolean)
                                    .join(" "),
                            )
                            .join("\n")}
                    />
                </div>
            </div>
        );
    };
}

let managerButton = combine(
    control,
    tva({
        base: {
            minHeight: 0,
            padding: [t.spacing(2), t.spacing(2.5)],
            border: 0,
            borderBottom: `${t.size.focus} solid transparent`,
            borderRadius: 0,
            fontFamily: t.font.mono,
            fontSize: t.text.sm,
            lineHeight: t.text.leading.snug,
            "&:hover": { backgroundColor: "transparent", color: t.color.text },
            "&[aria-pressed='true']": { borderBottomColor: t.color.link, color: t.color.text },
        },
    }),
);

let managerButtonStyle = managerButton<HTMLButtonElement>();

let commandStyle = css<HTMLSpanElement>({ color: t.color.code.command });

let flagStyle = css<HTMLSpanElement>({ color: t.color.code.flag });
