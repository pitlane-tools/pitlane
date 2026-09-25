/**
 * Pitlane request-cost attribution probe.
 *
 * A single-file, plain-JavaScript Worker module. No JSX, no custom compiler,
 * no repository build plugins. Every import is either a bare specifier that
 * resolves from `.docs/node_modules` (the directory this file is meant to be
 * placed under, beside `.docs/dist/ssr/index.js`) or nothing at all.
 *
 * The point of the file is *controlled* attribution: cases differ from their
 * neighbour by exactly one factor, and wherever possible neighbouring cases
 * emit byte-identical HTML so that a timing difference cannot be explained by
 * a difference in output. Cases that necessarily change the output are marked
 * `outputChanging: true` in the manifest and in CASES below.
 *
 * Timing is deliberately NOT measured in here. Workers freeze the clock
 * between I/O operations, so an in-worker `Date.now()`/`performance.now()`
 * delta is not a CPU measurement. The client measures wall time; Cloudflare's
 * GraphQL analytics measures CPU. Bookkeeping overhead is included in every
 * probe response; case-first does not imply a fresh isolate or an unwarmed renderer.
 */

import { css as themeCss, tva as themeTva } from "@pitlane/theme";
import { createCookie } from "remix/cookie";
import { render } from "remix/middleware/render";
import { createController, createRouter } from "remix/router";
import { get, post, route } from "remix/routes";
import { css as remixCss } from "remix/ui";
import { jsx } from "remix/ui/jsx-runtime";
import { renderToStream, renderToString } from "remix/ui/server";

// workerd rejects any named export from an entry module that is not a function
// or a handler, so the version travels as a function rather than a string.
const PROBE_VERSION = "1.0.0";

export function probeVersion() {
    return PROBE_VERSION;
}

/* ------------------------------------------------------------------ *
 * Element construction: the JSX runtime's own entry point, called by
 * hand. `jsx(type, props, key)` is exactly what a compiler emits.
 * ------------------------------------------------------------------ */

/** `h(type, props, ...children)` — a plain createElement over `jsx`. */
function h(type, props, ...children) {
    let p = props === null || props === undefined ? {} : props;
    if (children.length === 1) p.children = children[0];
    else if (children.length > 1) p.children = children;
    return jsx(type, p, p.key);
}

/* ------------------------------------------------------------------ *
 * Design tokens.
 *
 * Reconstructed from the CSS the real documentation Worker emits (the
 * custom-property names are read off its own `<style data-rmx-style>`
 * rules), so a style object built here hashes to the same class name
 * the real site serves. `assertInvariants()` checks that.
 * ------------------------------------------------------------------ */

const t = {
    color: {
        text: "var(--color-text)",
        secondary: "var(--color-secondary)",
        link: "var(--color-link)",
        linkHover: "var(--color-link-hover)",
        hover: "var(--color-hover)",
        selected: "var(--color-selected)",
        canvas: "var(--color-canvas)",
        line: "var(--color-line)",
        surface: "var(--color-surface)",
    },
    text: {
        "2xs": "var(--text-2xs)",
        xs: "var(--text-xs)",
        sm: "var(--text-sm)",
        md: "var(--text-md)",
        lg: "var(--text-lg)",
        xl: "var(--text-xl)",
        leading: { compact: "var(--text-leading-compact)", prose: "var(--text-leading-prose)" },
    },
    weight: {
        regular: "var(--weight-regular)",
        medium: "var(--weight-medium)",
        bold: "var(--weight-bold)",
    },
    tracking: { tight: "var(--tracking-tight)", caps: "var(--tracking-caps)" },
    radius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        panel: "var(--radius-panel)",
    },
    size: {
        full: "var(--size-full)",
        control: "var(--size-control)",
        hairline: "var(--size-hairline)",
        barsHeight: "var(--size-bars-height)",
        outlineTop: "var(--size-outline-top)",
        belowBars: "var(--size-below-bars)",
        sidebarOffset: "var(--size-sidebar-offset)",
        disclosureHeight: "var(--size-disclosure-height)",
    },
    shadow: { panel: "var(--shadow-panel)" },
    duration: { fast: "var(--duration-fast)", moderate: "var(--duration-moderate)" },
    ease: { standard: "var(--ease-standard)" },
    layer: { sectionBar: "var(--layer-section-bar)", header: "var(--layer-header)" },
    spacing(n) {
        return `calc(var(--spacing) * ${n})`;
    },
};

const narrow = "@media (width < 56.25rem)";
const belowOutlineColumn = "@media (width < 80rem)";
const outlineColumn = "@media (width >= 80rem)";

const stateTransition =
    `background-color ${t.duration.fast} ${t.ease.standard}, ` +
    `color ${t.duration.fast} ${t.ease.standard}, ` +
    `border-color ${t.duration.fast} ${t.ease.standard}`;

/* ------------------------------------------------------------------ *
 * The real documentation's `navLink`, verbatim.
 *
 * Copied from `.docs/app/styles/controls.ts`. This is the hot style in
 * the dense page: every outline row resolves it.
 * ------------------------------------------------------------------ */

const navLinkConfig = {
    base: {
        display: "flex",
        alignItems: "center",
        width: t.size.full,
        minHeight: t.size.control,
        padding: [t.spacing(1.75), t.spacing(3)],
        borderRadius: t.radius.md,
        color: t.color.link,
        fontSize: t.text.md,
        lineHeight: t.text.leading.compact,
        textDecoration: "none",
        overflowWrap: "anywhere",
        transition: stateTransition,
        "&:hover": { color: t.color.linkHover, backgroundColor: t.color.hover },
        "&[aria-current]": { color: t.color.text, backgroundColor: t.color.selected },
    },
    variants: {
        depth: {
            section: {},
            subsection: { paddingInlineStart: t.spacing(7) },
            deeper: { paddingInlineStart: t.spacing(11) },
        },
        size: {
            md: {},
            sm: { fontSize: t.text.xs, padding: [t.spacing(2), t.spacing(3)] },
        },
    },
    defaultVariants: { depth: "section", size: "md" },
};

/** The real `@pitlane/theme` tva, over the real config. */
const navLink = themeTva(navLinkConfig);

/* ------------------------------------------------------------------ *
 * Instrumented copies.
 *
 * `normalizeStyles` is copied from `packages/theme/src/css.ts`;
 * `deepMerge` from `packages/theme/src/tva.ts`; `hashStyle` from
 * `@remix-run/ui`'s `src/style/style.ts`. They exist so that call
 * counts and isolated per-operation cost can be measured without
 * monkey-patching the installed packages. The rendering cases never
 * touch them — they call the real exports.
 * ------------------------------------------------------------------ */

const counters = {
    normalizeStyles: 0,
    deepMerge: 0,
    hashStyle: 0,
    hashStyleChars: 0,
    tvaResolve: 0,
    distinctHashes: new Set(),
};

function countedNormalizeStyles(styles) {
    counters.normalizeStyles++;
    let out = {};
    for (let [key, value] of Object.entries(styles)) {
        if (Array.isArray(value)) out[key] = value.join(" ");
        else if (typeof value === "object" && value !== null)
            out[key] = countedNormalizeStyles(value);
        else out[key] = value;
    }
    return out;
}

/** Uncounted twin, used at module scope to precompute shared objects. */
function normalizeStyles(styles) {
    let out = {};
    for (let [key, value] of Object.entries(styles)) {
        if (Array.isArray(value)) out[key] = value.join(" ");
        else if (typeof value === "object" && value !== null) out[key] = normalizeStyles(value);
        else out[key] = value;
    }
    return out;
}

function countedHashStyle(obj) {
    counters.hashStyle++;
    let sortedEntries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
    let str = JSON.stringify(sortedEntries);
    counters.hashStyleChars += str.length;
    let h1 = 0x811c9dc5;
    let h2 = 0xcbf29ce4;
    for (let i = 0; i < str.length; i++) {
        let char = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ char, 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ char, 0x01000193) >>> 0;
    }
    let hash = h1.toString(36) + h2.toString(36);
    counters.distinctHashes.add(hash);
    return hash;
}

function hashStyle(obj) {
    let sortedEntries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
    let str = JSON.stringify(sortedEntries);
    let h1 = 0x811c9dc5;
    let h2 = 0xcbf29ce4;
    for (let i = 0; i < str.length; i++) {
        let char = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ char, 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ char, 0x01000193) >>> 0;
    }
    return h1.toString(36) + h2.toString(36);
}

function resetCounters() {
    counters.normalizeStyles = 0;
    counters.deepMerge = 0;
    counters.hashStyle = 0;
    counters.hashStyleChars = 0;
    counters.tvaResolve = 0;
    counters.distinctHashes = new Set();
}

/* ------------------------------------------------------------------ *
 * Precomputed style objects.
 *
 * `NORMALIZED_DEPTH[d]` is what `navLink({ size: 'sm', depth: d })`
 * produces *after* `@pitlane/theme`'s normalization: the object the
 * style engine actually hashes. Feeding it to `remixCss` directly, to
 * `themeCss` (which normalizes an already-normal object, a no-op), or
 * re-deriving it through `navLink()` all yield the same class name and
 * the same rule text. The three outline cases are therefore
 * output-identical and differ only in per-element work.
 * ------------------------------------------------------------------ */

const DEPTHS = ["section", "subsection", "deeper"];

const NORMALIZED_DEPTH = Object.freeze({
    section: Object.freeze(normalizeStyles(navLink.resolve({ size: "sm", depth: "section" }))),
    subsection: Object.freeze(
        normalizeStyles(navLink.resolve({ size: "sm", depth: "subsection" })),
    ),
    deeper: Object.freeze(normalizeStyles(navLink.resolve({ size: "sm", depth: "deeper" }))),
});

const CLASS_DEPTH = {
    section: "rmxc-" + hashStyle(NORMALIZED_DEPTH.section),
    subsection: "rmxc-" + hashStyle(NORMALIZED_DEPTH.subsection),
    deeper: "rmxc-" + hashStyle(NORMALIZED_DEPTH.deeper),
};

/**
 * The class names the deployed documentation actually serves for the
 * three outline row depths, read from a captured response. If the
 * reconstruction above drifts, `/probe/_info` reports the mismatch
 * rather than silently measuring a different style.
 */
const OBSERVED_CLASS_DEPTH = {
    section: "rmxc-r9i3z1tuvtt6",
    subsection: "rmxc-fw7azd1qe5f2s",
    deeper: "rmxc-qqk4yu1r2e5h",
};

/** One frozen style object, and a factory for a structurally identical fresh one. */
const FROZEN_STYLE = Object.freeze(
    normalizeStyles(navLink.resolve({ size: "sm", depth: "subsection" })),
);

function freshEquivalentStyle() {
    return {
        display: "flex",
        alignItems: "center",
        width: t.size.full,
        minHeight: t.size.control,
        padding: `${t.spacing(2)} ${t.spacing(3)}`,
        borderRadius: t.radius.md,
        color: t.color.link,
        fontSize: t.text.xs,
        lineHeight: t.text.leading.compact,
        textDecoration: "none",
        overflowWrap: "anywhere",
        transition: stateTransition,
        "&:hover": { color: t.color.linkHover, backgroundColor: t.color.hover },
        "&[aria-current]": { color: t.color.text, backgroundColor: t.color.selected },
        paddingInlineStart: t.spacing(7),
    };
}

/* ------------------------------------------------------------------ *
 * Static document chrome, constant across every rendering case.
 * ------------------------------------------------------------------ */

const TOKEN_CSS =
    ":root{--spacing:0.25rem;--color-text:#111;--color-secondary:#666;--color-link:#1a5fb4;" +
    "--color-link-hover:#0b3d91;--color-hover:#f2f2f4;--color-selected:#e7e9ee;--color-canvas:#fff;" +
    "--color-line:#e2e2e6;--color-surface:#fafafb;--text-2xs:0.6875rem;--text-xs:0.8125rem;" +
    "--text-sm:0.875rem;--text-md:0.9375rem;--text-lg:1.125rem;--text-xl:1.5rem;" +
    "--text-leading-compact:1.35;--text-leading-prose:1.7;--weight-regular:400;--weight-medium:500;" +
    "--weight-bold:700;--tracking-tight:-0.015em;--tracking-caps:0.06em;--radius-sm:4px;--radius-md:8px;" +
    "--radius-lg:10px;--radius-panel:16px;--size-full:100%;--size-control:2rem;--size-hairline:1px;" +
    "--size-bars-height:6.5rem;--size-outline-top:7rem;--size-below-bars:calc(100dvh - 8rem);" +
    "--size-sidebar-offset:17rem;--size-disclosure-height:60dvh;--shadow-panel:0 8px 24px rgba(0,0,0,.12);" +
    "--duration-fast:150ms;--duration-moderate:300ms;--ease-standard:cubic-bezier(.4,0,.2,1);" +
    "--layer-section-bar:48;--layer-header:50}";

function documentShell(title, body) {
    return h(
        "html",
        { lang: "en" },
        h(
            "head",
            null,
            h("meta", { charset: "utf-8" }),
            h("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
            h("title", null, title),
            h("style", null, TOKEN_CSS),
        ),
        h("body", null, body),
    );
}

/* ------------------------------------------------------------------ *
 * Content generation. Deterministic: the same `n` always produces the
 * same text, so byte counts and hashes are stable.
 * ------------------------------------------------------------------ */

const WORDS = [
    "adapter",
    "binding",
    "cache",
    "document",
    "entry",
    "fixture",
    "gateway",
    "handler",
    "isolate",
    "journal",
    "kernel",
    "loader",
    "manifest",
    "namespace",
    "outline",
    "payload",
    "queue",
    "runtime",
    "segment",
    "template",
    "upstream",
    "vector",
    "worker",
    "yield",
];

function headings(n) {
    let out = new Array(n);
    for (let i = 0; i < n; i++) {
        let level = i % 7 === 0 ? 2 : i % 3 === 0 ? 3 : 4;
        out[i] = {
            id: `${WORDS[i % WORDS.length]}-${i}`,
            text: `${WORDS[i % WORDS.length]} ${WORDS[(i * 7) % WORDS.length]} ${i}`,
            level,
        };
    }
    return out;
}

function depthOf(level) {
    return level <= 2 ? "section" : level === 3 ? "subsection" : "deeper";
}

/* ------------------------------------------------------------------ *
 * Outline variants: identical markup and identical class names, three
 * different amounts of per-element style work, plus one deliberately
 * output-changing control with no style engine at all.
 * ------------------------------------------------------------------ */

function outlineRows(list, styleFor) {
    let items = new Array(list.length);
    for (let i = 0; i < list.length; i++) {
        let heading = list[i];
        items[i] = h(
            "li",
            { key: heading.id },
            h("a", { href: `#${heading.id}`, ...styleFor(heading) }, heading.text),
        );
    }
    return h("nav", { id: "doc-outline" }, h("ol", null, items));
}

const outlineStyles = {
    /** Native `remix/ui` css mixin over a shared, already-normalized object. */
    remixcss: heading => ({ mix: remixCss(NORMALIZED_DEPTH[depthOf(heading.level)]) }),
    /** `@pitlane/theme` css: the same object, plus one normalization pass per element. */
    themecss: heading => ({ mix: themeCss(NORMALIZED_DEPTH[depthOf(heading.level)]) }),
    /** The real documentation path: tva resolution, then normalization, per element. */
    tva: heading => ({ mix: navLink({ size: "sm", depth: depthOf(heading.level) }) }),
    /** No style engine: a literal class attribute. Output-changing. */
    plain: heading => ({ className: CLASS_DEPTH[depthOf(heading.level)] }),
};

/* ------------------------------------------------------------------ *
 * Style-identity cases: same rendered bytes, different object identity.
 * ------------------------------------------------------------------ */

function styledBoxes(n, kind) {
    let items = new Array(n);
    for (let i = 0; i < n; i++) {
        let mix =
            kind === "frozen"
                ? remixCss(FROZEN_STYLE)
                : kind === "fresh"
                  ? remixCss(freshEquivalentStyle())
                  : remixCss({ ...freshEquivalentStyle(), zIndex: i });
        items[i] = h("div", { key: i, mix }, WORDS[i % WORDS.length]);
    }
    return h("section", { id: "boxes" }, items);
}

/* ------------------------------------------------------------------ *
 * Page composition: chrome + article + outline, the shape of a real
 * documentation page without any of the site's build machinery.
 * ------------------------------------------------------------------ */

const ARTICLE_SECTIONS = 40;

const chromeStyles = [];
for (let i = 0; i < 40; i++) {
    chromeStyles.push(
        Object.freeze(
            normalizeStyles({
                display: i % 2 ? "flex" : "block",
                alignItems: "center",
                gap: t.spacing(i % 5),
                padding: [t.spacing(1 + (i % 4)), t.spacing(2 + (i % 3))],
                borderRadius: t.radius.md,
                color: i % 3 ? t.color.text : t.color.secondary,
                fontSize: t.text.sm,
                lineHeight: t.text.leading.prose,
                backgroundColor: i % 7 ? t.color.surface : t.color.canvas,
                "&:hover": { backgroundColor: t.color.hover },
            }),
        ),
    );
}

function chrome() {
    let header = h(
        "header",
        { mix: remixCss(chromeStyles[0]) },
        h("a", { href: "/", mix: remixCss(chromeStyles[1]) }, "Pitlane"),
        h("nav", { mix: remixCss(chromeStyles[2]) }, "Guides Reference Packages"),
    );
    let links = new Array(124);
    for (let i = 0; i < 124; i++) {
        links[i] = h(
            "li",
            { key: i },
            h(
                "a",
                {
                    href: `/package/${WORDS[i % WORDS.length]}/${i}`,
                    mix: navLink({ size: "md", depth: i % 4 === 0 ? "section" : "subsection" }),
                },
                `${WORDS[i % WORDS.length]} ${i}`,
            ),
        );
    }
    let sidebar = h(
        "aside",
        { id: "doc-nav", mix: remixCss(chromeStyles[3]) },
        h("ul", null, links),
    );
    return [header, sidebar];
}

function article(sections) {
    let out = new Array(sections);
    for (let i = 0; i < sections; i++) {
        let style = chromeStyles[4 + (i % 36)];
        out[i] = h(
            "section",
            { key: i, id: `s-${i}` },
            h("h2", { id: `h-${i}`, mix: remixCss(style) }, `${WORDS[i % WORDS.length]} ${i}`),
            h(
                "p",
                { mix: remixCss(chromeStyles[4 + ((i + 7) % 36)]) },
                `The ${WORDS[i % WORDS.length]} resolves ${WORDS[(i * 3) % WORDS.length]} before the ` +
                    `${WORDS[(i * 5) % WORDS.length]} is written, which keeps the ` +
                    `${WORDS[(i * 11) % WORDS.length]} out of the request path.`,
            ),
            h(
                "pre",
                { mix: remixCss(chromeStyles[4 + ((i + 13) % 36)]) },
                h(
                    "code",
                    null,
                    `export let ${WORDS[i % WORDS.length]}${i} = createHandler({ n: ${i} });`,
                ),
            ),
        );
    }
    return h("main", { id: "content" }, out);
}

function pageTree(n) {
    return documentShell(
        `Probe page (${n} headings)`,
        h(
            "div",
            { id: "layout" },
            ...chrome(),
            article(ARTICLE_SECTIONS),
            outlineRows(headings(n), outlineStyles.tva),
        ),
    );
}

/* ------------------------------------------------------------------ *
 * Trees, by case.
 * ------------------------------------------------------------------ */

const MINIMAL_TREE = () => documentShell("Probe", h("h1", null, "Probe"));

function treeFor(caseId, n) {
    switch (caseId) {
        case "render-min":
        case "render-min-direct":
        case "render-min-stream":
        case "render-min-nobody":
            return MINIMAL_TREE();
        case "outline-remixcss":
            return documentShell("Outline", outlineRows(headings(n), outlineStyles.remixcss));
        case "outline-themecss":
            return documentShell("Outline", outlineRows(headings(n), outlineStyles.themecss));
        case "outline-tva":
            return documentShell("Outline", outlineRows(headings(n), outlineStyles.tva));
        case "outline-plain":
            return documentShell("Outline", outlineRows(headings(n), outlineStyles.plain));
        case "style-frozen":
            return documentShell("Boxes", styledBoxes(n, "frozen"));
        case "style-fresh":
            return documentShell("Boxes", styledBoxes(n, "fresh"));
        case "style-unique":
            return documentShell("Boxes", styledBoxes(n, "unique"));
        case "shell-nav":
            return documentShell("Shell", h("div", { id: "layout" }, ...chrome()));
        case "page":
        case "page-prepared":
            return pageTree(n);
        default:
            return null;
    }
}

/* ------------------------------------------------------------------ *
 * Router / cookie / middleware ladder.
 * ------------------------------------------------------------------ */

const probeRoutes = route({
    submit: post("/probe/_submit"),
    probe: get("/*path"),
});

const PREFERENCE_KEYS = ["build-mode", "color-scheme", "package-manager"];
const preferenceCookies = PREFERENCE_KEYS.map(name =>
    createCookie(`pl_${name}`, { path: "/", sameSite: "lax" }),
);

/**
 * Parses the three preference cookies. When the client sends no `Cookie`
 * header there is nothing to parse and the case would measure nothing, so a
 * representative header stands in: the work is then identical whoever calls
 * it, which is what makes `router-cookie` comparable to `router`.
 */
const STAND_IN_COOKIE_HEADER =
    "pl_build-mode=vite; pl_color-scheme=dark; pl_package-manager=pnpm; _cfuvid=nTq0m1w8; cf_clearance=aG9sZA";

async function readPreferences(request) {
    let header = request.headers.get("cookie") ?? STAND_IN_COOKIE_HEADER;
    let values = await Promise.all(preferenceCookies.map(cookie => cookie.parse(header)));
    return { a: values[0] ?? null, b: values[1] ?? null, c: values[2] ?? null };
}

/** Router with no render middleware: isolates route matching and dispatch. */
const plainRouter = createRouter();
plainRouter.map(
    probeRoutes,
    createController(probeRoutes, {
        actions: {
            submit() {
                return new Response("ok");
            },
            async probe(context) {
                let url = context.url ?? new URL(context.request.url);
                if (url.searchParams.get("cookies") === "1") {
                    let preferences = await readPreferences(context.request);
                    return new Response(preferences.a === null ? "ok" : "ok");
                }
                return new Response("ok");
            },
        },
    }),
);

/** Router plus the render middleware, exactly as `.docs/app/entry.server.tsx` wires it. */
const renderRouter = createRouter({ middleware: [render()] });
renderRouter.map(
    probeRoutes,
    createController(probeRoutes, {
        actions: {
            submit() {
                return new Response("ok");
            },
            probe(context) {
                let url = context.url ?? new URL(context.request.url);
                let caseId = url.searchParams.get("case") ?? "render-min";
                let n = clampN(url.searchParams.get("n"));
                return context.render(treeFor(caseId, n));
            },
        },
    }),
);

/* ------------------------------------------------------------------ *
 * Bookkeeping: isolate identity, cold/warm, per-case sequence.
 * ------------------------------------------------------------------ */

// Workers forbid random values and asynchronous I/O in global scope, so the
// isolate's identity is minted on its first request instead of at load.
let isolateId = null;

function ISOLATE_ID_OF() {
    isolateId ??= Math.random().toString(36).slice(2, 10);
    return isolateId;
}
const seen = new Map();
const preparedCache = new Map();

function bookkeeping(caseId) {
    let count = (seen.get(caseId) ?? 0) + 1;
    seen.set(caseId, count);
    return { cold: count === 1, seq: count };
}

function clampN(raw) {
    let n = Number.parseInt(raw ?? "", 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, 5000);
}

function respond(body, caseId, n, extra) {
    let { cold, seq } = bookkeeping(caseId);
    let headers = new Headers({
        "content-type":
            typeof body === "string" ? "text/html; charset=utf-8" : "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-probe-case": caseId,
        "x-probe-n": String(n),
        "x-probe-cold": cold ? "1" : "0",
        "x-probe-seq": String(seq),
        "x-probe-isolate": ISOLATE_ID_OF(),
        "x-probe-version": PROBE_VERSION,
    });
    if (extra) for (let [k, v] of Object.entries(extra)) headers.set(k, String(v));
    return new Response(body, { headers });
}

function jsonResponse(value, status) {
    return new Response(JSON.stringify(value, null, 2), {
        status: status ?? 200,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
}

/* ------------------------------------------------------------------ *
 * The case table. `manifest()` serializes it for CI.
 * ------------------------------------------------------------------ */

const CASES = [
    {
        id: "floor",
        group: "plumbing",
        primary: true,
        n: [0],
        isolates: "Nothing. Request in, constant response out.",
        contract: "body === 'ok'",
        outputChanging: true,
        comparedTo: null,
    },
    {
        id: "floor-html",
        group: "plumbing",
        primary: false,
        n: [0],
        isolates:
            "Response construction for a body the size of the minimal document, with no rendering.",
        contract: "bytes === bytes(render-min)",
        outputChanging: false,
        comparedTo: "render-min-direct",
    },
    {
        id: "router",
        group: "plumbing",
        primary: true,
        n: [0],
        isolates: "remix/router route matching + controller dispatch.",
        contract: "body === 'ok'",
        outputChanging: false,
        comparedTo: "floor",
    },
    {
        id: "router-cookie",
        group: "plumbing",
        primary: true,
        n: [0],
        isolates: "Parsing three preference cookies with remix/cookie.",
        contract: "body === 'ok'",
        outputChanging: false,
        comparedTo: "router",
    },
    {
        id: "render-min-direct",
        group: "render",
        primary: true,
        n: [0],
        isolates: "renderToString of a minimal document, no router, no middleware.",
        contract: "html document, <h1>Probe</h1>",
        outputChanging: false,
        comparedTo: "floor-html",
    },
    {
        id: "render-min-stream",
        group: "render",
        primary: true,
        n: [0],
        isolates: "Returning renderToStream's ReadableStream instead of awaiting the string.",
        contract: "same rendered element tree as render-min-direct",
        outputChanging: true,
        outputNote:
            "The doctype and flush marker differ from render-min-direct; bytes are not identical.",
        comparedTo: "render-min-direct",
    },
    {
        id: "render-min-nobody",
        group: "render",
        primary: false,
        n: [0],
        isolates:
            "Building the stream and cancelling it: work charged before any body is consumed.",
        contract: "empty body, status 204",
        outputChanging: true,
        comparedTo: "render-min-stream",
    },
    {
        id: "render-min",
        group: "render",
        primary: true,
        n: [0],
        isolates: "Router + render() middleware around the same minimal document.",
        contract: "same rendered element tree as render-min-direct",
        outputChanging: true,
        outputNote:
            "Middleware adds a doctype relative to render-min-stream; bytes are not identical.",
        comparedTo: "render-min-stream",
    },
    {
        id: "outline-plain",
        group: "outline",
        primary: true,
        n: [0, 10, 100, 1000, 2209],
        isolates: "Outline markup with literal class attributes: no style engine at all.",
        contract: "n <a> rows; no <style data-rmx-style> tags",
        outputChanging: true,
        comparedTo: "outline-remixcss",
    },
    {
        id: "outline-remixcss",
        group: "outline",
        primary: true,
        n: [0, 10, 100, 1000, 2209],
        isolates: "Native remix/ui css() over a shared pre-normalized object.",
        contract: "byte-identical to outline-themecss and outline-tva",
        outputChanging: true,
        comparedTo: "outline-plain",
    },
    {
        id: "outline-themecss",
        group: "outline",
        primary: true,
        n: [0, 10, 100, 1000, 2209],
        isolates: "@pitlane/theme css(): one normalizeStyles pass per element.",
        contract: "byte-identical to outline-remixcss",
        outputChanging: false,
        comparedTo: "outline-remixcss",
    },
    {
        id: "outline-tva",
        group: "outline",
        primary: true,
        n: [0, 10, 100, 1000, 2209],
        isolates: "The real documentation path: tva resolve + normalize per element.",
        contract: "byte-identical to outline-remixcss",
        outputChanging: false,
        comparedTo: "outline-themecss",
    },
    {
        id: "style-frozen",
        group: "identity",
        primary: true,
        n: [0, 100, 1000, 2209],
        isolates: "n elements sharing one frozen style object (identity reuse).",
        contract: "byte-identical to style-fresh",
        outputChanging: false,
        comparedTo: "style-fresh",
    },
    {
        id: "style-fresh",
        group: "identity",
        primary: true,
        n: [0, 100, 1000, 2209],
        isolates: "n elements each constructing a structurally identical fresh object.",
        contract: "byte-identical to style-frozen",
        outputChanging: false,
        comparedTo: "style-frozen",
    },
    {
        id: "style-unique",
        group: "identity",
        primary: false,
        n: [0, 100, 1000],
        isolates: "n elements each with a distinct style object: n cache misses, n rules.",
        contract: "n distinct rmxc- classes",
        outputChanging: true,
        comparedTo: "style-fresh",
    },
    {
        id: "hash-only",
        group: "microbench",
        primary: true,
        n: [0, 100, 1000, 2209],
        isolates: "hashStyle over the real outline style object, n times. No rendering.",
        contract: "JSON { hash, n }",
        outputChanging: true,
        comparedTo: null,
    },
    {
        id: "normalize-only",
        group: "microbench",
        primary: true,
        n: [0, 100, 1000, 2209],
        isolates: "normalizeStyles over the real outline style object, n times. No rendering.",
        contract: "JSON { keys, n }",
        outputChanging: true,
        comparedTo: null,
    },
    {
        id: "tva-only",
        group: "microbench",
        primary: true,
        n: [0, 100, 1000, 2209],
        isolates: "navLink.resolve(), n times. No rendering.",
        contract: "JSON { keys, n }",
        outputChanging: true,
        comparedTo: null,
    },
    {
        id: "shell-nav",
        group: "page",
        primary: true,
        n: [0],
        isolates: "Header + 124-row sidebar navigation only, no article, no outline.",
        contract: "124 sidebar links",
        outputChanging: true,
        comparedTo: "render-min-direct",
    },
    {
        id: "page",
        group: "page",
        primary: true,
        n: [0, 10, 100, 1000, 2209],
        isolates: "Chrome + 40-section article + outline(n) through the real tva path.",
        contract: "byte-identical to page-prepared at the same n",
        outputChanging: false,
        comparedTo: "page-prepared",
    },
    {
        id: "page-prepared",
        group: "page",
        primary: true,
        n: [0, 10, 100, 1000, 2209],
        isolates: "The same document rendered once per isolate, then served from a cached string.",
        contract: "byte-identical to page at the same n; the first request for EACH n renders",
        outputChanging: false,
        comparedTo: "page",
    },
];

function manifest() {
    return {
        probeVersion: PROBE_VERSION,
        routes: {
            case: "/probe/<id>?n=<n>",
            manifest: "/probe/_manifest",
            info: "/probe/_info",
            validate: "/probe/_validate?case=<id>&n=<n>",
            counts: "/probe/_counts?case=<id>&n=<n>",
            currentWorker: "/current/* (only in probe-current.js)",
        },
        headers: {
            "x-probe-case": "case id",
            "x-probe-n": "resolved n",
            "x-probe-cold": "1 when this isolate had not served this case before",
            "x-probe-seq": "1-based request count for this case in this isolate",
            "x-probe-isolate": "random per-isolate id; groups requests served by one isolate",
        },
        notes: [
            "No timing is measured inside the Worker: the clock does not advance between I/O.",
            "Cases marked outputChanging alter the response; their timing delta mixes work and bytes.",
            "Cases with comparedTo and outputChanging=false emit byte-identical HTML to that case.",
            "/probe/_validate without a `case` renders every case in one invocation. Locally that is " +
                "convenient; on a metered platform it is one very long request. Validate per case, or " +
                "hash the bodies the timing run already fetched.",
            "/probe/_counts models expected calls using copied algorithms; it does not observe " +
                "@remix-run/ui execution. Timed rendering cases call the installed public exports.",
            "The microbench cases (hash-only, normalize-only, tva-only) run copied algorithms, not the " +
                "installed ones. They neither measure nor bound native-library internal cost.",
            "router-cookie parses a built-in stand-in Cookie header when the client sends none, so the " +
                "case measures the same work regardless of caller.",
        ],
        cases: CASES,
    };
}

/* ------------------------------------------------------------------ *
 * Case execution.
 * ------------------------------------------------------------------ */

/**
 * A complete document. `renderToString` emits the element tree only, so the
 * doctype is prepended here; every string-rendering case goes through this
 * one function, which keeps the prepared-HTML baseline byte-identical to the
 * case it is the baseline for.
 */
function renderDocument(tree) {
    return renderToString(tree).then(html => "<!DOCTYPE html>" + html);
}

// Lazy for the same reason: rendering reaches for crypto, which global scope
// may not use.
let minimalHtmlPromise = null;
let minimalHtml = null;

async function runCase(caseId, n, request) {
    switch (caseId) {
        case "floor":
            return respond("ok", caseId, n);

        case "floor-html": {
            minimalHtmlPromise ??= renderDocument(MINIMAL_TREE());
            minimalHtml ??= await minimalHtmlPromise;
            return respond(minimalHtml, caseId, n);
        }

        case "router":
        case "router-cookie": {
            let url = new URL(request.url);
            url.searchParams.set("cookies", caseId === "router-cookie" ? "1" : "0");
            let response = await plainRouter.fetch(new Request(url, request));
            let { cold, seq } = bookkeeping(caseId);
            let headers = new Headers(response.headers);
            headers.set("x-probe-case", caseId);
            headers.set("x-probe-n", String(n));
            headers.set("x-probe-cold", cold ? "1" : "0");
            headers.set("x-probe-seq", String(seq));
            headers.set("x-probe-isolate", ISOLATE_ID_OF());
            return new Response(response.body, { status: response.status, headers });
        }

        case "render-min": {
            let url = new URL(request.url);
            url.searchParams.set("case", "render-min");
            let response = await renderRouter.fetch(new Request(url, request));
            let { cold, seq } = bookkeeping(caseId);
            let headers = new Headers(response.headers);
            headers.set("x-probe-case", caseId);
            headers.set("x-probe-n", String(n));
            headers.set("x-probe-cold", cold ? "1" : "0");
            headers.set("x-probe-seq", String(seq));
            headers.set("x-probe-isolate", ISOLATE_ID_OF());
            return new Response(response.body, { status: response.status, headers });
        }

        case "render-min-stream": {
            let stream = renderToStream(MINIMAL_TREE());
            return respond(stream, caseId, n, { "content-type": "text/html; charset=utf-8" });
        }

        case "render-min-nobody": {
            let stream = renderToStream(MINIMAL_TREE());
            await stream.cancel();
            let { cold, seq } = bookkeeping(caseId);
            return new Response(null, {
                status: 204,
                headers: {
                    "x-probe-case": caseId,
                    "x-probe-n": String(n),
                    "x-probe-cold": cold ? "1" : "0",
                    "x-probe-seq": String(seq),
                    "x-probe-isolate": ISOLATE_ID_OF(),
                },
            });
        }

        case "hash-only": {
            let style = NORMALIZED_DEPTH.subsection;
            let last = "";
            for (let i = 0; i < n; i++) last = hashStyle(style);
            return respond(JSON.stringify({ hash: last, n }), caseId, n, {
                "content-type": "application/json; charset=utf-8",
            });
        }

        case "normalize-only": {
            let style = navLink.resolve({ size: "sm", depth: "subsection" });
            let keys = 0;
            for (let i = 0; i < n; i++) keys = Object.keys(normalizeStyles(style)).length;
            return respond(JSON.stringify({ keys, n }), caseId, n, {
                "content-type": "application/json; charset=utf-8",
            });
        }

        case "tva-only": {
            let keys = 0;
            for (let i = 0; i < n; i++) {
                keys = Object.keys(navLink.resolve({ size: "sm", depth: DEPTHS[i % 3] })).length;
            }
            return respond(JSON.stringify({ keys, n }), caseId, n, {
                "content-type": "application/json; charset=utf-8",
            });
        }

        case "page-prepared": {
            let key = `page-prepared:${n}`;
            let cached = preparedCache.get(key);
            if (cached === undefined) {
                cached = await renderDocument(pageTree(n));
                preparedCache.set(key, cached);
            }
            return respond(cached, caseId, n);
        }

        default: {
            let tree = treeFor(caseId, n);
            if (tree === null) return jsonResponse({ error: `unknown case '${caseId}'` }, 404);
            return respond(await renderDocument(tree), caseId, n);
        }
    }
}

/* ------------------------------------------------------------------ *
 * Validation and instrumentation routes. Never time these.
 * ------------------------------------------------------------------ */

async function sha256Hex(text) {
    let digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function validate(caseId, n) {
    let response = await runCase(
        caseId,
        n,
        new Request(`https://probe.invalid/probe/${caseId}?n=${n}`),
    );
    let body = await response.text();
    let styleTags = (body.match(/<style[^>]*data-rmx-style/g) ?? []).length;
    let classes = new Set(body.match(/rmxc-[a-z0-9]+/g) ?? []);
    return {
        case: caseId,
        n,
        status: response.status,
        bytes: new TextEncoder().encode(body).length,
        sha256: await sha256Hex(body),
        anchors: (body.match(/<a /g) ?? []).length,
        styleTags,
        distinctStyleClasses: classes.size,
    };
}

function countsFor(caseId, n) {
    resetCounters();
    let list = headings(n);
    for (let heading of list) {
        let depth = depthOf(heading.level);
        if (caseId === "outline-tva") {
            counters.tvaResolve++;
            countedHashStyle(countedNormalizeStyles(navLink.resolve({ size: "sm", depth })));
        } else if (caseId === "outline-themecss") {
            countedHashStyle(countedNormalizeStyles(NORMALIZED_DEPTH[depth]));
        } else if (caseId === "outline-remixcss") {
            countedHashStyle(NORMALIZED_DEPTH[depth]);
        }
    }
    return {
        case: caseId,
        n,
        tvaResolve: counters.tvaResolve,
        normalizeStyles: counters.normalizeStyles,
        hashStyle: counters.hashStyle,
        hashStyleChars: counters.hashStyleChars,
        distinctHashes: counters.distinctHashes.size,
        meaning:
            "hashStyle runs once per styled element per request; distinctHashes is how many " +
            "rule texts are actually generated. The gap is repeated work that the content-addressed " +
            "cache cannot avoid, because the cache key is the hash itself.",
    };
}

function info() {
    let classMatch = DEPTHS.every(d => CLASS_DEPTH[d] === OBSERVED_CLASS_DEPTH[d]);
    return {
        probeVersion: PROBE_VERSION,
        isolate: ISOLATE_ID_OF(),
        userAgent: typeof navigator === "undefined" ? null : (navigator.userAgent ?? null),
        reconstructedClasses: CLASS_DEPTH,
        observedClassesFromRealSite: OBSERVED_CLASS_DEPTH,
        styleReconstructionMatchesDeployedSite: classMatch,
        servedCases: Object.fromEntries(seen),
    };
}

/* ------------------------------------------------------------------ *
 * Entry point.
 * ------------------------------------------------------------------ */

export async function handleProbe(request) {
    let url = new URL(request.url);
    let path = url.pathname;
    if (!path.startsWith("/probe/")) return null;

    let id = path.slice("/probe/".length);
    let n = clampN(url.searchParams.get("n"));

    if (id === "_manifest") return jsonResponse(manifest());
    if (id === "_info") return jsonResponse(info());
    if (id === "_validate") {
        let caseId = url.searchParams.get("case");
        if (!caseId) {
            let all = [];
            for (let entry of CASES)
                for (let each of entry.n) all.push(await validate(entry.id, each));
            return jsonResponse({ probeVersion: PROBE_VERSION, results: all });
        }
        return jsonResponse(await validate(caseId, n));
    }
    if (id === "_counts") {
        let caseId = url.searchParams.get("case") ?? "outline-tva";
        return jsonResponse(countsFor(caseId, n));
    }

    return runCase(id, n, request);
}

export default {
    async fetch(request) {
        let response = await handleProbe(request);
        if (response) return response;
        return jsonResponse(
            {
                error: "not a probe route",
                hint: "GET /probe/_manifest",
                probeVersion: PROBE_VERSION,
            },
            404,
        );
    },
};
