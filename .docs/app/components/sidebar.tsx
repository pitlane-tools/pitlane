import { css, type ThemedCSSProps } from "@pitlane/theme";
import { clientEntry, type Handle } from "remix/ui";

import type { ApiModule, GuideGroup, Navigation, NavigationLink } from "./navigation.ts";

import { onPreferenceChange, rememberedPreference } from "../browser/preferences.ts";
import { type BuildMode, DEFAULT_PREFERENCES } from "../document.ts";
import { collapse, eyebrow, floatingPanel, inPlacePopover, navLink } from "../styles/controls.ts";
import { narrow, navCollapsed, wide } from "../styles/media.ts";
import { t } from "../theme.ts";

export const DOCUMENT_NAVIGATION_ID = "docs-navigation";

// Links sit a step inside the headings they belong to, so the nesting reads
// at a glance.
let linkList: ThemedCSSProps = {
    display: "flex",
    flexDirection: "column",
    gap: t.spacing(1),
    margin: 0,
    padding: 0,
    listStyle: "none",
};

let topLinkListStyle = css<HTMLUListElement>(linkList);

let linkListStyle = css<HTMLUListElement>({ ...linkList, paddingInlineStart: t.spacing(4) });

let linkStyle = navLink<HTMLAnchorElement>();

// The sidebar's type follows the Remix API reference: module and section
// labels in small tracked capitals, and group headings a size smaller and
// quieter.
let groupTitleStyle = css<HTMLParagraphElement>({
    ...eyebrow,
    padding: [t.spacing(1.5), t.spacing(2)],
    fontSize: t.text["3xs"],
});

let groupsStyle = css<HTMLElement>({
    display: "flex",
    flexDirection: "column",
    gap: t.spacing(2),
    margin: 0,
    padding: [t.spacing(1), 0, t.spacing(3), t.spacing(2)],
    listStyle: "none",
});

let sectionLabel: ThemedCSSProps = {
    ...eyebrow,
    display: "flex",
    alignItems: "center",
    minHeight: t.size.control,
    padding: t.spacing(2),
    color: t.color.text,
    fontSize: t.text.xs,
    letterSpacing: t.tracking.label,
};

let moduleSummaryStyle = css<HTMLElement>({
    ...sectionLabel,
    position: "relative",
    paddingInlineEnd: t.spacing(7),
    borderRadius: t.radius.md,
    overflowWrap: "anywhere",
    listStyle: "none",
    cursor: "pointer",
    "&::-webkit-details-marker": { display: "none" },
    "&:hover": { backgroundColor: t.color.hover },
    // A drawn chevron, turned down while the module is open.
    "&::after": {
        content: '""',
        position: "absolute",
        right: t.spacing(3),
        width: t.spacing(1.5),
        height: t.spacing(1.5),
        borderRight: `${t.size.hairline} solid`,
        borderBottom: `${t.size.hairline} solid`,
        opacity: 0.55,
        transform: "rotate(-45deg)",
        transition: `transform ${t.duration.fast} ${t.ease.standard}`,
    },
    ":is(details[open]) > &::after": { transform: "rotate(45deg)" },
});

/**
 * The section's document navigation: a fixed column on wide screens and a
 * native popover, disclosed from the section bar, on narrow ones.
 */
export function DocumentNavigation(handle: Handle<{ navigation: Navigation }>) {
    return () => {
        let { navigation } = handle.props;
        return (
            <nav
                aria-label={navigation.label}
                id={DOCUMENT_NAVIGATION_ID}
                mix={css({
                    ...inPlacePopover,
                    position: "fixed",
                    insetBlock: [t.size.sidebarTop, 0],
                    insetInlineStart: t.size.gutter,
                    width: t.size.sidebar,
                    paddingBottom: t.spacing(10),
                    overflowY: "auto",
                    overscrollBehavior: "contain",
                    [wide]: {
                        transition: `opacity ${collapse}, visibility 0s`,
                        // Fades, then leaves the tab order once out of sight.
                        [navCollapsed]: {
                            visibility: "hidden",
                            opacity: 0,
                            pointerEvents: "none",
                            transition: `opacity ${collapse}, visibility 0s linear ${t.duration.fast}`,
                        },
                    },
                    [narrow]: {
                        "&:not(:popover-open)": { display: "none" },
                        "&:popover-open": {
                            ...floatingPanel,
                            position: "fixed",
                            inset: [t.size.barsHeight, 0, 0],
                            width: "auto",
                            height: "auto",
                            padding: [t.spacing(3), t.spacing(4), t.spacing(10)],
                            border: 0,
                            borderRadius: 0,
                            backgroundColor: t.color.canvas,
                            overflowY: "auto",
                        },
                    },
                })}
                popover
            >
                <p mix={css(sectionLabel)}>{navigation.label}</p>
                {navigation.section === "guides" ? (
                    <GuideGroups groups={navigation.groups} />
                ) : (
                    <ApiModules modules={navigation.modules} />
                )}
            </nav>
        );
    };
}

function GuideGroups(handle: Handle<{ groups: GuideGroup[] }>) {
    return () => (
        <ul mix={groupsStyle}>
            {handle.props.groups.map(group => (
                <li key={group.title}>
                    <p mix={groupTitleStyle}>{group.title}</p>
                    <LinkList links={group.links} />
                </li>
            ))}
        </ul>
    );
}

/** One native disclosure per module, open on the module being read. */
function ApiModules(handle: Handle<{ modules: ApiModule[] }>) {
    return () => (
        <div
            mix={css({
                display: "flex",
                flexDirection: "column",
                gap: t.spacing(1),
                marginTop: t.spacing(1),
            })}
        >
            {handle.props.modules.map(module => (
                <details key={module.module} open={module.open}>
                    <summary mix={moduleSummaryStyle}>{module.module}</summary>
                    <div mix={groupsStyle}>
                        <LinkList links={[module.overview]} nested={false} />
                        {module.kinds.map(group => (
                            <div key={group.kind}>
                                <p mix={groupTitleStyle}>{group.title}</p>
                                <LinkList links={group.links} />
                            </div>
                        ))}
                    </div>
                </details>
            ))}
        </div>
    );
}

/** Links under a group heading are `nested`, a step inside it; a module's overview stands alone. */
function LinkList(handle: Handle<{ links: NavigationLink[]; nested?: boolean }>) {
    return () => (
        <ul mix={handle.props.nested === false ? topLinkListStyle : linkListStyle}>
            {handle.props.links.map(link => (
                <li key={link.url}>
                    {link.variants ? (
                        <SetupLink title={link.title} variants={link.variants} />
                    ) : (
                        <a
                            aria-current={link.current ? "page" : undefined}
                            href={link.url}
                            mix={linkStyle}
                        >
                            {link.title}
                        </a>
                    )}
                </li>
            ))}
        </ul>
    );
}

type SetupLinkProps = {
    title: string;
    variants: Record<BuildMode, string>;
};

/**
 * A two-setup guide other than the one being read, linked in the setup the
 * reader last chose with the build-mode switch, or the default one.
 */
export let SetupLink = clientEntry(import.meta.url, (handle: Handle<SetupLinkProps>) => {
    handle.queueTask(() =>
        onPreferenceChange("buildMode", () => void handle.update(), handle.signal),
    );

    return () => {
        let { title, variants } = handle.props;
        let setup = rememberedPreference("buildMode") ?? DEFAULT_PREFERENCES.buildMode;
        return (
            <a href={variants[setup]} mix={linkStyle}>
                {title}
            </a>
        );
    };
});
