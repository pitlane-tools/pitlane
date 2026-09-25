import type { Handle } from "remix/ui";

import { combine, css, tva } from "@pitlane/theme";

import type { DocumentPage, Preferences } from "../document.ts";

import { control, eyebrow, floatingPanel, inPlacePopover } from "../styles/controls.ts";
import { belowOutlineColumn, compact, narrow, outlineColumn, wide } from "../styles/media.ts";
import { t } from "../theme.ts";
import { MoonIcon, SunIcon, SystemIcon } from "./icons.tsx";
import { Wordmark } from "./logo.tsx";
import { PRIMARY_LINKS, REPOSITORY_URL } from "./navigation.ts";
import { PopoverToggle } from "./popover-toggle.tsx";
import { SearchDialog } from "./search-dialog.tsx";

type Theme = Preferences["theme"];

const THEMES: { value: Theme; label: string; Icon: typeof SystemIcon }[] = [
    { value: "system", label: "System", Icon: SystemIcon },
    { value: "light", label: "Light", Icon: SunIcon },
    { value: "dark", label: "Dark", Icon: MoonIcon },
];

const PRIMARY_NAVIGATION_ID = "site-primary-navigation";
const THEME_MENU_ID = "site-theme-menu";

export interface SiteHeaderProps {
    /** The section being read; the 404 document has none. */
    section?: DocumentPage["section"];
    theme: Theme;
    /** Where a theme choice returns the reader. */
    returnTo: string;
    /** Documentation pages head the sidebar column with the search field. */
    search: "sidebar" | "header";
}

export function SiteHeader(handle: Handle<SiteHeaderProps>) {
    return () => {
        let { section, theme, returnTo, search } = handle.props;
        let inGuides = section === "guides" || section === "deploy";
        return (
            <header
                mix={css({
                    position: "fixed",
                    inset: [0, 0, "auto"],
                    zIndex: t.layer.header,
                    display: "flex",
                    alignItems: "center",
                    gap: t.spacing(6),
                    height: t.size.header,
                    padding: [0, t.size.gutter],
                    backgroundColor: t.color.canvas,
                    [narrow]: {
                        gap: t.spacing(2),
                        padding: [0, t.spacing(2), 0, t.spacing(4)],
                        borderBottom: `${t.size.hairline} solid ${t.color.border}`,
                    },
                })}
            >
                {/* The home page is still the previous site, so it loads as a document of its own. */}
                <a
                    aria-label="Pitlane home"
                    data-rmx-document
                    href="/"
                    mix={css({
                        display: "inline-flex",
                        alignItems: "center",
                        height: t.spacing(10),
                        marginInlineEnd: "auto",
                        color: t.color.text,
                    })}
                >
                    <Wordmark />
                </a>
                <nav
                    aria-label="Primary"
                    id={PRIMARY_NAVIGATION_ID}
                    mix={css({
                        ...inPlacePopover,
                        display: "flex",
                        alignItems: "center",
                        gap: t.spacing(6),
                        "& a": {
                            color: t.color.link,
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                            "&:hover": { color: t.color.linkHover },
                            "&[aria-current]": { color: t.color.text },
                        },
                        [compact]: {
                            "&:not(:popover-open)": { display: "none" },
                            "&:popover-open": {
                                ...floatingPanel,
                                position: "fixed",
                                inset: [t.size.header, 0, "auto"],
                                flexDirection: "column",
                                alignItems: "stretch",
                                gap: t.spacing(1),
                                padding: [t.spacing(2), t.spacing(4), t.spacing(4)],
                                borderRadius: 0,
                                backgroundColor: t.color.canvas,
                            },
                            "&:popover-open a": {
                                display: "flex",
                                alignItems: "center",
                                minHeight: t.size.touch,
                                padding: [t.spacing(2), t.spacing(3)],
                                borderRadius: t.radius.md,
                                "&:hover": { backgroundColor: t.color.hover },
                            },
                        },
                    })}
                    popover
                >
                    <a aria-current={inGuides ? "true" : undefined} href={PRIMARY_LINKS.guides}>
                        Guides
                    </a>
                    <a
                        aria-current={section === "api" ? "true" : undefined}
                        href={PRIMARY_LINKS.api}
                    >
                        API
                    </a>
                    <a href={REPOSITORY_URL}>GitHub</a>
                </nav>
                <div mix={css({ display: "flex", alignItems: "center", gap: t.spacing(1) })}>
                    <SearchDialog placement={search} />
                    <ThemeMenu returnTo={returnTo} theme={theme} />
                    <PopoverToggle
                        compactOnly
                        controls={PRIMARY_NAVIGATION_ID}
                        icon="menu"
                        label="Site menu"
                    />
                </div>
            </header>
        );
    };
}

/**
 * The appearance choice: a native popover holding an ordinary form, so it
 * opens, submits, and redirects back without a script. With one, Remix
 * submits it as a document navigation and the page answers in the new theme.
 */
function ThemeMenu(handle: Handle<{ theme: Theme; returnTo: string }>) {
    return () => {
        let { theme, returnTo } = handle.props;
        let current = THEMES.find(option => option.value === theme)!;
        return (
            <>
                <PopoverToggle
                    controls={THEME_MENU_ID}
                    icon={theme}
                    label={`Theme: ${current.label}`}
                />
                <form
                    action="/preferences"
                    data-rmx-history="replace"
                    data-rmx-reset-scroll="false"
                    id={THEME_MENU_ID}
                    method="post"
                    mix={css({
                        ...floatingPanel,
                        position: "fixed",
                        inset: [t.size.menuTop, t.spacing(4), "auto", "auto"],
                        width: t.size.menu,
                    })}
                    popover
                >
                    <input name="preference" type="hidden" value="theme" />
                    <input name="returnTo" type="hidden" value={returnTo} />
                    <p
                        id={`${THEME_MENU_ID}-label`}
                        mix={css({
                            ...eyebrow,
                            padding: [t.spacing(1.5), t.spacing(2.5), t.spacing(1)],
                        })}
                    >
                        Theme
                    </p>
                    <div aria-labelledby={`${THEME_MENU_ID}-label`} role="group">
                        {THEMES.map(({ value, label, Icon }) => (
                            <button
                                aria-pressed={value === theme ? "true" : "false"}
                                mix={themeOption()}
                                name="value"
                                type="submit"
                                value={value}
                            >
                                <Icon />
                                {label}
                            </button>
                        ))}
                    </div>
                </form>
            </>
        );
    };
}

let themeOption = combine(
    control,
    tva({
        base: {
            justifyContent: "flex-start",
            gap: t.spacing(2.5),
            width: t.size.full,
            minHeight: t.spacing(8.5),
            padding: [t.spacing(1.5), t.spacing(2.5)],
            color: t.color.text,
            fontSize: t.text.md,
            "&[aria-pressed='true']": {
                backgroundColor: t.color.selected,
                fontWeight: t.weight.semibold,
            },
        },
    }),
);

/**
 * The bar under the header while the sidebar or the outline has no column of
 * its own: it discloses the document navigation below `narrow`, and the page
 * outline below `outlineColumn`.
 */
export function SectionBar(
    handle: Handle<{ label: string; navigation: string; outline?: string }>,
) {
    return () => {
        let { label, navigation, outline } = handle.props;
        return (
            <div mix={sectionBar({ outline: outline !== undefined })}>
                <span mix={css({ [wide]: { display: "none" } })}>
                    <PopoverToggle controls={navigation} text={label} />
                </span>
                {outline ? (
                    <span mix={css({ marginInlineStart: "auto" })}>
                        <PopoverToggle controls={outline} text="On this page" />
                    </span>
                ) : null}
            </div>
        );
    };
}

let sectionBar = tva({
    base: {
        position: "fixed",
        insetBlockStart: t.size.header,
        insetInline: [t.size.sidebarOffset, 0],
        zIndex: t.layer.sectionBar,
        display: "none",
        alignItems: "center",
        height: t.size.sectionBar,
        padding: [0, t.spacing(4)],
        borderBottom: `${t.size.hairline} solid ${t.color.border}`,
        borderTopLeftRadius: t.radius.panel,
        backgroundColor: t.color.surface,
        [narrow]: {
            display: "flex",
            insetInline: 0,
            borderTopLeftRadius: 0,
            backgroundColor: t.color.canvas,
        },
        [outlineColumn]: { display: "none" },
    },
    variants: {
        outline: {
            true: { [belowOutlineColumn]: { display: "flex" } },
        },
    },
});
