import type { Handle } from "remix/ui";

import { css, type ThemedCSSProps } from "@pitlane/theme";

import type { ApiModule, GuideGroup, Navigation, NavigationLink } from "./navigation.ts";

import { eyebrow, floatingPanel, inPlacePopover, navLink } from "../styles/controls.ts";
import { narrow } from "../styles/media.ts";
import { t } from "../theme.ts";

export const DOCUMENT_NAVIGATION_ID = "docs-navigation";

let linkList: ThemedCSSProps = {
    display: "flex",
    flexDirection: "column",
    gap: t.spacing(0.5),
    margin: 0,
    padding: 0,
    listStyle: "none",
};

let linkListStyle = css<HTMLUListElement>(linkList);

let linkStyle = navLink<HTMLAnchorElement>();

let groupTitleStyle = css<HTMLParagraphElement>({
    ...eyebrow,
    padding: [t.spacing(1.5), t.spacing(3), t.spacing(0.5)],
});

let moduleSummaryStyle = css<HTMLElement>({
    ...eyebrow,
    position: "relative",
    display: "flex",
    alignItems: "center",
    minHeight: t.size.control,
    padding: [t.spacing(2), t.spacing(7), t.spacing(2), t.spacing(2)],
    borderRadius: t.radius.md,
    color: t.color.text,
    fontSize: t.text.xs,
    letterSpacing: "normal",
    textTransform: "none",
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

let moduleContentsStyle = css<HTMLDivElement>({
    display: "flex",
    flexDirection: "column",
    gap: t.spacing(2),
    padding: [t.spacing(1), 0, t.spacing(3), t.spacing(2)],
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
                <p
                    mix={css({
                        ...eyebrow,
                        display: "flex",
                        alignItems: "center",
                        minHeight: t.size.control,
                        padding: t.spacing(2),
                        color: t.color.text,
                        fontSize: t.text.xs,
                    })}
                >
                    {navigation.label}
                </p>
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
        <ul mix={css({ ...linkList, gap: t.spacing(4), marginTop: t.spacing(1) })}>
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
                    <div mix={moduleContentsStyle}>
                        <LinkList links={[module.overview]} />
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

function LinkList(handle: Handle<{ links: NavigationLink[] }>) {
    return () => (
        <ul mix={linkListStyle}>
            {handle.props.links.map(link => (
                <li key={link.url}>
                    <a
                        aria-current={link.current ? "page" : undefined}
                        href={link.url}
                        mix={linkStyle}
                    >
                        {link.title}
                    </a>
                </li>
            ))}
        </ul>
    );
}
