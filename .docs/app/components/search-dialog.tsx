import { combine, css, type ThemedCSSProps, tva } from "@pitlane/theme";
import { clientEntry, type Handle, on, ref } from "remix/ui";

import { loadSearchEngine, type SearchHit, searchDocumentation } from "../browser/pagefind.ts";
import { control, visuallyHidden } from "../styles/controls.ts";
import { compact, narrow, noScript, wide } from "../styles/media.ts";
import { t } from "../theme.ts";
import { CloseIcon, SearchIcon } from "./icons.tsx";

type Status =
    | { kind: "idle" }
    | { kind: "searching" }
    | { kind: "done"; total: number }
    | { kind: "failed" };

const UNAVAILABLE = "Search is unavailable right now.";

export type SearchDialogProps = {
    /** Documentation pages head the sidebar column with the field; the 404 page keeps it in the header. */
    placement: "sidebar" | "header";
};

let field: ThemedCSSProps = {
    justifyContent: "flex-start",
    padding: [0, t.spacing(2.5)],
    borderColor: t.color.control,
    backgroundColor: t.color.raised,
    fontSize: t.text.md,
    "&:hover": { borderColor: t.color.strong, backgroundColor: t.color.raised },
};

let opener = combine(
    control,
    tva({
        base: {
            [noScript]: { display: "none" },
            [narrow]: { "& [data-label]": visuallyHidden, "& kbd": { display: "none" } },
        },
        variants: {
            placement: {
                sidebar: {
                    [wide]: {
                        ...field,
                        position: "fixed",
                        insetBlockStart: t.size.header,
                        insetInlineStart: t.size.gutter,
                        width: t.size.sidebar,
                    },
                },
                header: { [wide]: { ...field, width: t.size.menu } },
            },
        },
    }),
);

let keycap: ThemedCSSProps = {
    display: "inline-flex",
    gap: t.spacing(0.5),
    color: t.color.secondary,
    fontFamily: t.font.mono,
    fontSize: t.text.xs,
    lineHeight: "normal",
};

/**
 * Documentation search: an opener, and a modal dialog over a lazily loaded
 * Pagefind index. Results are ordinary links to canonical pages or their
 * sections, followed as document navigations; the arrow keys move between
 * the field and the results, Escape and the backdrop close the dialog, and
 * focus returns to where it was.
 *
 * Search needs a script, so a page read without one never shows the opener.
 */
export let SearchDialog = clientEntry(import.meta.url, (handle: Handle<SearchDialogProps>) => {
    let dialog: HTMLDialogElement | undefined;
    let input: HTMLInputElement | undefined;
    let results: HTMLElement | undefined;
    let returnFocus: HTMLElement | undefined;
    let query = "";
    let hits: SearchHit[] = [];
    let status: Status = { kind: "idle" };
    let generation = 0;
    /** The shortcut's modifier, known once the platform is. */
    let modifier: string | undefined;

    function open() {
        if (!dialog || dialog.open) return;
        returnFocus =
            document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
        dialog.showModal();
        input?.select();
        void prepare();
    }

    // Opening starts the engine download, so the first query does not wait for it.
    async function prepare() {
        try {
            await loadSearchEngine();
            if (!query.trim() && status.kind === "failed") {
                status = { kind: "idle" };
                void handle.update();
            }
        } catch (error) {
            if (query.trim()) return;
            status = { kind: "failed" };
            console.error(error);
            void handle.update();
        }
    }

    async function search(value: string) {
        query = value;
        let run = ++generation;
        if (!value.trim()) {
            hits = [];
            status = { kind: "idle" };
            return void handle.update();
        }
        status = { kind: "searching" };
        void handle.update();
        try {
            let outcome = await searchDocumentation(value);
            if (run !== generation || !outcome) return;
            hits = outcome.hits;
            status = { kind: "done", total: outcome.total };
        } catch (error) {
            if (run !== generation) return;
            hits = [];
            status = { kind: "failed" };
            console.error(error);
        }
        void handle.update();
    }

    function links(): HTMLAnchorElement[] {
        return results ? [...results.querySelectorAll("a")] : [];
    }

    handle.queueTask(() => {
        modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
        void handle.update();
        document.addEventListener(
            "keydown",
            event => {
                if (
                    !(event.metaKey || event.ctrlKey) ||
                    event.altKey ||
                    event.shiftKey ||
                    event.key.toLowerCase() !== "k"
                )
                    return;
                event.preventDefault();
                if (dialog?.open) dialog.close();
                else open();
            },
            { signal: handle.signal },
        );
    });

    return () => {
        let trimmed = query.trim();
        let message =
            status.kind === "searching"
                ? "Searching…"
                : status.kind === "failed"
                  ? UNAVAILABLE
                  : status.kind === "done"
                    ? status.total === 0
                        ? `No results for “${trimmed}”`
                        : `${status.total} ${status.total === 1 ? "result" : "results"}`
                    : "Search the guides, deployment pages, and API reference.";
        return (
            <>
                <button
                    aria-haspopup="dialog"
                    aria-keyshortcuts="Meta+K Control+K"
                    mix={[opener({ placement: handle.props.placement }), on("click", open)]}
                    type="button"
                >
                    <SearchIcon />
                    <span data-label mix={css({ flex: 1, textAlign: "start" })}>
                        Search
                    </span>
                    {modifier ? (
                        <kbd aria-hidden="true" mix={css(keycap)}>
                            {modifier} K
                        </kbd>
                    ) : null}
                </button>
                <dialog
                    aria-label="Search documentation"
                    mix={[
                        css({
                            inset: [t.size.header, 0, "auto"],
                            width: t.size.dialogWidth,
                            maxWidth: t.size.full,
                            maxHeight: t.size.dialogHeight,
                            margin: [t.spacing(2), "auto", 0],
                            padding: 0,
                            border: `${t.size.hairline} solid ${t.color.border}`,
                            borderRadius: t.radius.xl,
                            backgroundColor: t.color.raised,
                            color: t.color.text,
                            boxShadow: t.shadow.lg,
                            overflow: "hidden",
                            "&[open]": { display: "flex", flexDirection: "column" },
                            "&::backdrop": {
                                backgroundColor: t.color.backdrop,
                                backdropFilter: "blur(2px)",
                            },
                            [compact]: {
                                inset: 0,
                                width: t.size.full,
                                maxHeight: t.size.viewport,
                                margin: 0,
                                border: 0,
                                borderRadius: 0,
                            },
                        }),
                        ref(node => {
                            dialog = node as HTMLDialogElement;
                        }),
                        on("click", event => {
                            // Only the backdrop is the dialog itself; its content fills the box.
                            if (event.target === event.currentTarget) dialog?.close();
                        }),
                        on("keydown", event => {
                            // A search field would spend the first Escape clearing itself.
                            if (event.key !== "Escape") return;
                            event.preventDefault();
                            dialog?.close();
                        }),
                        on("close", () => {
                            if (returnFocus?.isConnected) returnFocus.focus();
                            returnFocus = undefined;
                        }),
                    ]}
                >
                    <form
                        mix={[
                            css({
                                display: "flex",
                                alignItems: "center",
                                gap: t.spacing(3),
                                padding: [t.spacing(3), t.spacing(4)],
                                borderBottom: `${t.size.hairline} solid ${t.color.border}`,
                                color: t.color.secondary,
                            }),
                            on("submit", event => {
                                event.preventDefault();
                                if (status.kind === "done") links()[0]?.click();
                            }),
                        ]}
                        role="search"
                    >
                        <SearchIcon />
                        <input
                            aria-describedby="search-status"
                            aria-label="Search guides and API"
                            autocomplete="off"
                            mix={[
                                css({
                                    flex: 1,
                                    minWidth: 0,
                                    height: t.size.control,
                                    padding: 0,
                                    border: 0,
                                    backgroundColor: "transparent",
                                    color: t.color.text,
                                    font: "inherit",
                                    fontSize: t.text.base,
                                    fontWeight: t.weight.medium,
                                    outline: "none",
                                    "&::-webkit-search-cancel-button": { display: "none" },
                                }),
                                ref(node => {
                                    input = node as HTMLInputElement;
                                }),
                                on("input", event => void search(event.currentTarget.value)),
                                on("keydown", event => {
                                    if (event.key !== "ArrowDown") return;
                                    event.preventDefault();
                                    links()[0]?.focus();
                                }),
                            ]}
                            name="q"
                            placeholder="Search guides and API"
                            spellcheck={false}
                            type="search"
                        />
                        <button
                            aria-label="Close search"
                            mix={[control(), on("click", () => dialog?.close())]}
                            type="button"
                        >
                            <CloseIcon />
                        </button>
                    </form>
                    <div
                        mix={css({
                            display: "flex",
                            alignItems: "center",
                            gap: t.spacing(2),
                            padding: [t.spacing(2.5), t.spacing(5), 0],
                            color: status.kind === "failed" ? t.color.danger : t.color.secondary,
                            fontSize: t.text.sm,
                        })}
                    >
                        <p
                            aria-live="polite"
                            id="search-status"
                            mix={css({ margin: 0 })}
                            role="status"
                        >
                            {message}
                        </p>
                        {status.kind === "failed" ? (
                            <button
                                mix={[
                                    control({ tone: "field" }),
                                    on("click", () => void (trimmed ? search(query) : prepare())),
                                ]}
                                type="button"
                            >
                                Retry
                            </button>
                        ) : null}
                    </div>
                    {hits.length > 0 ? (
                        <ul
                            aria-label="Results"
                            mix={[
                                css({
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: t.spacing(1),
                                    margin: 0,
                                    padding: [t.spacing(3), t.spacing(4), t.spacing(4)],
                                    listStyle: "none",
                                    overflowY: "auto",
                                    overscrollBehavior: "contain",
                                }),
                                ref((node, signal) => {
                                    results = node as HTMLElement;
                                    // Enter must never follow a result that is no longer listed.
                                    signal.addEventListener("abort", () => {
                                        if (results === node) results = undefined;
                                    });
                                }),
                                on("click", event => {
                                    if (
                                        event.target instanceof Element &&
                                        event.target.closest("a")
                                    )
                                        dialog?.close();
                                }),
                                on("keydown", event => {
                                    if (event.key !== "ArrowDown" && event.key !== "ArrowUp")
                                        return;
                                    event.preventDefault();
                                    let all = links();
                                    let index =
                                        all.findIndex(link => link === document.activeElement) +
                                        (event.key === "ArrowDown" ? 1 : -1);
                                    if (index < 0) input?.focus();
                                    else all[Math.min(index, all.length - 1)]?.focus();
                                }),
                            ]}
                        >
                            {hits.map(hit => (
                                <li key={hit.href}>
                                    <Result hit={hit} />
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </dialog>
            </>
        );
    };
});

let badge: ThemedCSSProps = {
    color: t.color.secondary,
    fontFamily: t.font.mono,
    fontSize: t.text["2xs"],
    fontWeight: t.weight.medium,
    letterSpacing: t.tracking.caps,
    textTransform: "uppercase",
};

let resultStyle = css<HTMLAnchorElement>({
    display: "block",
    padding: [t.spacing(2.5), t.spacing(4)],
    borderRadius: t.radius.lg,
    backgroundColor: t.color.subtle,
    color: "inherit",
    textDecoration: "none",
    transition: `background-color ${t.duration.fast} ${t.ease.standard}`,
    "&:hover": { backgroundColor: t.color.muted },
    "&:focus-visible": { backgroundColor: t.color.selected },
});

let resultTitleStyle = css<HTMLSpanElement>({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: t.spacing(2),
    color: t.color.link,
    fontSize: t.text.md,
    fontWeight: t.weight.semibold,
});

let badgeStyle = css<HTMLSpanElement>(badge);

let kindBadgeStyle = css<HTMLSpanElement>({ ...badge, color: t.color.accent });

let excerptStyle = css<HTMLSpanElement>({
    display: "block",
    marginTop: t.spacing(1),
    color: t.color.secondary,
    fontSize: t.text.sm,
    lineHeight: t.text.leading.normal,
    "& mark": {
        backgroundColor: "transparent",
        color: t.color.text,
        fontWeight: t.weight.semibold,
    },
});

/** One result: its page, what kind of page it is, and the matching passage. */
function Result(handle: Handle<{ hit: SearchHit }>) {
    return () => {
        let { hit } = handle.props;
        return (
            <a href={hit.href} mix={resultStyle}>
                <span mix={resultTitleStyle}>
                    {hit.title}
                    {hit.section ? <span mix={badgeStyle}>{hit.section}</span> : null}
                    {hit.module ? <span mix={badgeStyle}>{hit.module}</span> : null}
                    {hit.kind ? <span mix={kindBadgeStyle}>{hit.kind}</span> : null}
                </span>
                <span mix={excerptStyle}>
                    {hit.heading ? <strong>{hit.heading} — </strong> : null}
                    {/* Pagefind escapes the page text before adding its own <mark> elements. */}
                    <span innerHTML={hit.excerpt} />
                </span>
            </a>
        );
    };
}
