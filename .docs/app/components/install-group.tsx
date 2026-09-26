import { css } from "@pitlane/theme";
import { clientEntry, type Handle, on, ref } from "remix/ui";

import {
    onPreferenceChange,
    rememberedPreference,
    rememberPreference,
} from "../browser/preferences.ts";
import { DEFAULT_PREFERENCES, type PackageManager, PREFERENCE_STORAGE_KEYS } from "../document.ts";
import { t } from "../theme.ts";

// Type aliases rather than interfaces: hydrated props must satisfy Remix's
// serializable index signature, which interfaces do not implicitly have.
export type InstallAlternative = {
    manager: PackageManager;
    /** The command as complete Expressive Code markup, prepared by the build. */
    html: string;
};

export type InstallGroupProps = {
    alternatives: InstallAlternative[];
};

// Restore each disclosure before parsing its command: a script after the whole
// group can arrive too late to prevent a wrong-command paint on a slow response.
function restorePreferenceScript(alternatives: readonly InstallAlternative[]): string {
    let managers = alternatives.map(({ manager }) => manager);
    return (
        `{let g=document.currentScript.parentElement,c=${JSON.stringify(managers)},k=${JSON.stringify(PREFERENCE_STORAGE_KEYS.packageManager)},m;` +
        `try{m=localStorage.getItem(k)}catch{}` +
        `try{if(!c.includes(m))m=document.cookie.split(/;\\s*/).find(p=>p.startsWith(k+"="))?.slice(k.length+1)}catch{}` +
        `g.dataset.restored=c.includes(m)?m:c.includes(${JSON.stringify(DEFAULT_PREFERENCES.packageManager)})?${JSON.stringify(DEFAULT_PREFERENCES.packageManager)}:c[0]??""}`
    );
}

const RESTORE_DISCLOSURE =
    `{let d=document.currentScript.parentElement;` +
    `d.open=d.dataset.manager===d.parentElement.dataset.restored}`;

// The group draws the frame, so each command drops Expressive Code's own and
// shares the tabs' background. Its unlayered stylesheet outranks component
// styles, so this overrides the variables it reads instead, as a string
// because style objects would kebab-case their mixed-case names.
const FRAMELESS_CODE =
    "--ec-brdWd:0px;--ec-brdRad:0px;--ec-frm-frameBoxShdCssVal:none;--ec-codeBg:var(--ec-frm-trmBg)";

// Each disclosure's summary becomes a tab and its content the panel beneath
// them, which needs `::details-content`. A browser without it stacks the
// disclosures instead. The row scrolls sideways when the tabs outgrow the
// column, while the open panel stays pinned at the column's width.
let groupStyle = css<HTMLDivElement>({
    margin: [0, 0, t.spacing(4)],
    border: `${t.size.codeBorder} solid ${t.color.code.border}`,
    borderRadius: t.size.codeRadius,
    backgroundColor: t.color.code.frame,
    boxShadow: t.shadow.code,
    overflow: "hidden",
    "@supports selector(::details-content)": {
        containerType: "inline-size",
        display: "grid",
        gridTemplateColumns: "repeat(var(--tabs), max-content) 1fr",
        overflowX: "auto",
        scrollbarWidth: "none",
        // The rule continues past the last tab.
        "&::after": { content: '""', gridRow: 1, gridColumn: -2, boxShadow: t.shadow.tabRule },
    },
    "& .expressive-code": { margin: 0 },
});

let alternativeStyle = css<HTMLDetailsElement>({
    "@supports selector(::details-content)": {
        display: "contents",
        "&::details-content": {
            gridRow: 2,
            gridColumn: "1 / -1",
            position: "sticky",
            left: 0,
            width: t.size.container,
        },
    },
});

let tabStyle = css<HTMLElement>({
    display: "flex",
    alignItems: "center",
    gap: t.spacing(2),
    position: "relative",
    gridRow: 1,
    height: t.size.tab,
    padding: [0, t.spacing(3)],
    color: t.color.secondary,
    fontSize: t.text.md,
    fontWeight: t.weight.medium,
    whiteSpace: "nowrap",
    listStyle: "none",
    cursor: "pointer",
    boxShadow: t.shadow.tabRule,
    transition: `color ${t.duration.fast} ${t.ease.standard}`,
    "&::-webkit-details-marker": { display: "none" },
    "&:hover": { color: t.color.text },
    // The scrolling group would clip an outline drawn outside the tab.
    "&&:focus-visible": { outlineOffset: t.size.focusInset },
    // The open tab is the one being read: it cannot be closed, only replaced.
    ":is(details[open]) > &": {
        color: t.color.text,
        cursor: "default",
        pointerEvents: "none",
    },
    ":is(details[open]) > &::after": {
        content: '""',
        position: "absolute",
        insetInline: t.spacing(2),
        bottom: 0,
        height: t.size.focus,
        borderRadius: t.size.focus,
        backgroundColor: t.color.link,
    },
});

let iconStyle = css<HTMLImageElement>({ flex: "none", width: t.size.icon, height: t.size.icon });

/** The alternative the reader's preference opens: the remembered manager, else npm, else the first. */
function preferred(alternatives: readonly InstallAlternative[]): PackageManager | undefined {
    let remembered = rememberedPreference("packageManager");
    let managers = alternatives.map(({ manager }) => manager);
    if (remembered && managers.includes(remembered)) return remembered;
    return managers.includes(DEFAULT_PREFERENCES.packageManager)
        ? DEFAULT_PREFERENCES.packageManager
        : managers[0];
}

/**
 * An install command for every package manager, each in its own native
 * disclosure, so every command can be read and opened without a script. The
 * alternatives share a disclosure name, so opening one closes the others, and
 * they present as a row of tabs over the open command. The group shows the
 * remembered manager, or its default. Opening another remembers that manager,
 * and every group on the page follows.
 */
export let InstallGroup = clientEntry(import.meta.url, (handle: Handle<InstallGroupProps>) => {
    let server = typeof document === "undefined";
    let group: Element | undefined;
    // The alternative the preference opens, as last rendered. Only the
    // restoration and a change this group follows open it, so a disclosure
    // opening on anything else is the reader's choice.
    let shown: PackageManager | undefined;
    // Which disclosures are open, once hydration has adopted the markup's own
    // state. Until then the client renders no `open`, so hydration leaves the
    // restored state, and anything the reader opened meanwhile, in place.
    let opened: Set<PackageManager> | undefined;

    function follow() {
        let manager = preferred(handle.props.alternatives);
        opened = new Set(manager ? [manager] : []);
        void handle.update();
    }

    handle.queueTask(() => {
        onPreferenceChange("packageManager", follow, handle.signal);
        let root = group;
        // Markup a soft navigation inserted never ran its restoration: it
        // shows the static default, which the preference replaces.
        if (!root?.hasAttribute("data-restored")) return follow();
        let native = handle.props.alternatives
            .map(({ manager }) => manager)
            .filter(
                manager =>
                    root.querySelector<HTMLDetailsElement>(
                        `:scope > details[data-manager="${manager}"]`,
                    )?.open,
            );
        opened = new Set(native);
        // Compare with restoration, not a preference another group may have
        // changed while hydration was pending.
        let chosen = native.find(manager => manager !== root.getAttribute("data-restored"));
        if (chosen) rememberPreference("packageManager", chosen);
        else if (native.length) follow();
    });

    return () => {
        let { alternatives } = handle.props;
        shown = preferred(alternatives);
        return (
            <div
                mix={[
                    groupStyle,
                    ref(node => {
                        group = node;
                    }),
                ]}
                style={{ "--tabs": String(alternatives.length) }}
            >
                <script>{restorePreferenceScript(alternatives)}</script>
                {alternatives.map(({ manager, html }) => (
                    <details
                        data-manager={manager}
                        key={manager}
                        mix={[
                            alternativeStyle,
                            on("toggle", event => {
                                if (!opened) return;
                                let opening = event.newState === "open";
                                if (opening && manager !== shown) {
                                    rememberPreference("packageManager", manager);
                                    return;
                                }
                                if (opening) opened.add(manager);
                                else opened.delete(manager);
                                void handle.update();
                            }),
                        ]}
                        name={handle.id}
                        open={opened ? opened.has(manager) : server ? manager === shown : undefined}
                    >
                        <summary
                            mix={[
                                tabStyle,
                                // The open tab ignores the pointer, but a key
                                // press activates it with a click.
                                on("click", event => {
                                    if (event.currentTarget.parentElement?.hasAttribute("open")) {
                                        event.preventDefault();
                                    }
                                }),
                            ]}
                        >
                            <img
                                alt=""
                                height="16"
                                mix={iconStyle}
                                src={`/icons/${manager}.svg`}
                                width="16"
                            />
                            {manager}
                        </summary>
                        <script>{RESTORE_DISCLOSURE}</script>
                        <div innerHTML={html} style={FRAMELESS_CODE} />
                    </details>
                ))}
            </div>
        );
    };
});
