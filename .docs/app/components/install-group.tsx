import { combine, css, tva } from "@pitlane/theme";
import { clientEntry, type Handle, on, ref } from "remix/ui";

import {
    onPreferenceChange,
    rememberedPreference,
    rememberPreference,
} from "../browser/preferences.ts";
import { DEFAULT_PREFERENCES, type PackageManager, PREFERENCE_STORAGE_KEYS } from "../document.ts";
import { control } from "../styles/controls.ts";
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

let groupStyle = css<HTMLDivElement>({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: [t.spacing(1), t.spacing(0.5)],
    margin: [0, 0, t.spacing(4)],
    // The group spaces its alternatives, not the article's code-block rhythm.
    "& .expressive-code": { margin: 0 },
});

/** A closed alternative sits in a row with the others; an open one takes the full width. */
let alternativeStyle = css<HTMLDetailsElement>({
    minWidth: 0,
    "&[open]": { flexBasis: t.size.full },
});

let summary = combine(
    control,
    tva({
        base: {
            display: "list-item",
            minHeight: 0,
            padding: [t.spacing(1.5), t.spacing(2.5)],
            border: 0,
            borderBottom: `${t.size.focus} solid transparent`,
            borderRadius: 0,
            fontFamily: t.font.mono,
            fontSize: t.text.sm,
            lineHeight: t.text.leading.snug,
            listStylePosition: "inside",
            "&:hover": { backgroundColor: "transparent", color: t.color.text },
            ":is(details[open]) > &": {
                marginBottom: t.spacing(1.5),
                borderBottomColor: t.color.link,
                color: t.color.text,
            },
        },
    }),
);

let summaryStyle = summary<HTMLElement>();

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
 * alternatives share a disclosure name, so opening one closes the others. The
 * group shows the remembered manager, or its default. Opening another
 * remembers that manager, and every group on the page follows; closing one
 * forgets nothing.
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
                        <summary mix={summaryStyle}>{manager}</summary>
                        <script>{RESTORE_DISCLOSURE}</script>
                        <div innerHTML={html} />
                    </details>
                ))}
            </div>
        );
    };
});
