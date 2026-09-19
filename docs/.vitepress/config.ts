// @ts-expect-error: no types for this package
import { extendConfig } from "@voidzero-dev/vitepress-theme/config";
import { type DefaultTheme, defineConfig } from "vitepress";
import {
    groupIconMdPlugin,
    groupIconVitePlugin,
    localIconLoader,
} from "vitepress-plugin-group-icons";
import llmstxt, { copyOrDownloadAsMarkdownButtons } from "vitepress-plugin-llms";

import { buildModeTabsInlineScript } from "./build-mode-tabs.ts";
import { buildModes } from "./build-modes-plugin.ts";
import { BUILD_MODE_GUIDES } from "./build-modes.ts";
import { pmTabsInlineScript } from "./pm-tabs.ts";

const SITE_URL = "https://pitlane.tools";
const SITE_NAME = "Pitlane";
const SITE_DESCRIPTION = "Portable platform integration for Remix 3.";
const OG_IMAGE = `${SITE_URL}/media/pitlane-lockup.png`;

// Sidebar sections for unreleased packages live in git history; they return
// as their packages ship. The published site documents released surface only.
// (The pre-release Cloudflare-era guides sit in docs/internal/legacy-guides.)

// Shared by /guides and /deploy so both prefixes present one "Guides"
// section: general usage guides first, deployment guides under Deploy.
//
// A two-mode guide is one guide rendered at two URLs, and a sidebar row is
// highlighted by matching its own link against the current page — so the row
// has to name the mode being read or the highlight disappears on the other
// one. `current` maps each such guide to the URL of the mode in view.
/** The mode each two-mode guide shows unless the page in view says otherwise. */
const DEFAULT_MODES = {
    content: BUILD_MODE_GUIDES.content.vite,
    prerendering: BUILD_MODE_GUIDES.prerendering.vite,
};

let guides = (current: { content: string; prerendering: string }): DefaultTheme.SidebarItem[] => [
    {
        text: "Vite Plugin",
        items: [
            { text: "Overview", link: "/guides/vite-plugin" },
            { text: "Hot Module Replacement", link: "/guides/hmr" },
            { text: "Single-Page Apps", link: "/guides/spa" },
        ],
    },
    {
        text: "Styling",
        items: [
            //
            { text: "Overview", link: "/guides/styling" },
        ],
    },
    {
        text: "Crawling",
        items: [
            { text: "Overview", link: "/guides/crawler" },
            { text: "Prerendering", link: current.prerendering },
        ],
    },
    {
        text: "Content",
        items: [
            { text: "Overview", link: current.content },
            { text: "Creating a Content Loader", link: "/guides/content-loaders" },
        ],
    },
    {
        text: "Data",
        items: [
            //
            { text: "Cloudflare D1", link: "/guides/cloudflare-d1" },
        ],
    },
    {
        text: "Deployment",
        items: [
            { text: "Cloudflare Workers", link: "/deploy/cloudflare" },
            { text: "Netlify", link: "/deploy/netlify" },
            { text: "Vercel", link: "/deploy/vercel" },
            { text: "Railway", link: "/deploy/railway" },
            { text: "Deno Deploy", link: "/deploy/deno-deploy" },
            { text: "GitHub Pages", link: "/deploy/github-pages" },
        ],
    },
];

let config = defineConfig({
    title: SITE_NAME,
    titleTemplate: `:title | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    // `_`-prefixed files are partials a page includes, not pages of their own.
    srcExclude: ["superpowers/**", "internal/**", "**/_*.md"],
    cleanUrls: true,
    sitemap: { hostname: SITE_URL },
    transformPageData(pageData) {
        let slug = pageData.relativePath.replace(/index\.md$/, "").replace(/\.md$/, "");
        let url = `${SITE_URL}/${slug}`;
        let title = pageData.frontmatter.title ?? pageData.title ?? SITE_NAME;
        let ogTitle = title === SITE_NAME ? SITE_NAME : `${title} | ${SITE_NAME}`;
        let description =
            pageData.frontmatter.description || pageData.description || SITE_DESCRIPTION;

        pageData.frontmatter.head ??= [];
        pageData.frontmatter.head.push(
            ["meta", { property: "og:title", content: ogTitle }],
            ["meta", { property: "og:description", content: description }],
            ["meta", { property: "og:url", content: url }],
            ["meta", { name: "twitter:title", content: ogTitle }],
            ["meta", { name: "twitter:description", content: description }],
            ["link", { rel: "canonical", href: url }],
        );
    },
    markdown: {
        theme: {
            dark: "github-dark",
            light: "github-light",
        },
        config(md) {
            md.use(groupIconMdPlugin);
            md.use(copyOrDownloadAsMarkdownButtons);
        },
    },
    vite: {
        plugins: [
            // Before llmstxt(): it resolves includes itself and emits a Markdown
            // twin of every page, so the mode has to be resolved in the source
            // both of them read.
            buildModes(),
            groupIconVitePlugin({
                customIcon: {
                    vp: localIconLoader(import.meta.url, "../public/icons/vp.svg"),
                    vlt: localIconLoader(import.meta.url, "../public/icons/vlt.svg"),
                    nub: localIconLoader(import.meta.url, "../public/icons/nub.svg"),
                },
            }),
            // Emits llms.txt, llms-full.txt, and a raw-Markdown twin of every
            // page into the dist assets (build only). Mirrors `srcExclude`:
            // those pages are not on the site, so LLMs don't get them either.
            llmstxt({
                ignoreFiles: ["superpowers/**", "internal/**"],
                // The theme sidebar maps two prefixes ("/guides", "/deploy")
                // to the same `guides` array; the llms.txt TOC builder flattens
                // sidebar values and would list every section twice. Hand it
                // one deduped sidebar, with the API pages as a named section
                // instead of the fallback "Other" bucket.
                sidebar: [
                    ...guides(DEFAULT_MODES),
                    {
                        text: "Packages",
                        items: [
                            { text: "@pitlane/content", link: "/package/content/index" },
                            {
                                text: "@pitlane/content/loaders",
                                link: "/package/content/loaders",
                            },
                            {
                                text: "@pitlane/content/satteri",
                                link: "/package/content/satteri",
                            },
                            { text: "@pitlane/content/vite", link: "/package/content/vite" },
                            { text: "@pitlane/crawler", link: "/package/crawler/index" },
                            {
                                text: "@pitlane/data-table-d1",
                                link: "/package/data-table-d1/index",
                            },
                            {
                                text: "@pitlane/data-table-d1/migrations",
                                link: "/package/data-table-d1/migrations",
                            },
                            { text: "@pitlane/dev", link: "/package/dev/index" },
                            {
                                text: "@pitlane/dev/runtime",
                                link: "/package/dev/runtime",
                            },
                            { text: "@pitlane/theme", link: "/package/theme/index" },
                        ],
                    },
                ],
            }),
        ],
    },
    themeConfig: {
        logo: "/favicon.svg",
        socialLinks: [{ icon: "github", link: "https://github.com/pitlane-tools" }],
        outline: { level: "deep" },
        nav: [
            { text: "Guides", link: "/guides/vite-plugin", activeMatch: "^/(guides|deploy)/" },
            { text: "Packages", link: "/package/dev/", activeMatch: "/package/" },
        ],
        sidebar: {
            "/package/": [
                { text: "@pitlane/content", link: "/package/content/" },
                { text: "@pitlane/content/loaders", link: "/package/content/loaders" },
                { text: "@pitlane/content/satteri", link: "/package/content/satteri" },
                { text: "@pitlane/content/vite", link: "/package/content/vite" },
                { text: "@pitlane/crawler", link: "/package/crawler/" },
                { text: "@pitlane/data-table-d1", link: "/package/data-table-d1/" },
                {
                    text: "@pitlane/data-table-d1/migrations",
                    link: "/package/data-table-d1/migrations",
                },
                { text: "@pitlane/dev", link: "/package/dev/" },
                { text: "@pitlane/dev/runtime", link: "/package/dev/runtime" },
                { text: "@pitlane/theme", link: "/package/theme/" },
            ],
            // `getSidebar` prefers the key with the most path segments, so a
            // no-build page gets its own copy whose row points at itself.
            // `/guides` rather than `/guides/` keeps that ordering unambiguous:
            // the specific keys have one more segment.
            [BUILD_MODE_GUIDES.content["no-build"]]: guides({
                ...DEFAULT_MODES,
                content: BUILD_MODE_GUIDES.content["no-build"],
            }),
            [BUILD_MODE_GUIDES.prerendering["no-build"]]: guides({
                ...DEFAULT_MODES,
                prerendering: BUILD_MODE_GUIDES.prerendering["no-build"],
            }),
            "/guides": guides(DEFAULT_MODES),
            "/deploy": guides(DEFAULT_MODES),
        },
        footer: {
            copyright: `© ${new Date().getFullYear()} Pitlane contributors.`,
        },
    },
    head: [
        // Runs before the body streams in so stored package-manager tabs
        // apply before first paint - no flash of the default tab.
        ["script", {}, pmTabsInlineScript],
        // Same reason, one page earlier: a build mode is a URL, so a stored
        // choice has to redirect before anything renders rather than restyle
        // after it.
        ["script", {}, buildModeTabsInlineScript],
        ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
        ["meta", { property: "og:site_name", content: SITE_NAME }],
        ["meta", { property: "og:type", content: "website" }],
        ["meta", { property: "og:image", content: OG_IMAGE }],
        ["meta", { property: "og:image:width", content: "2508" }],
        ["meta", { property: "og:image:height", content: "1627" }],
        ["meta", { property: "og:image:alt", content: `${SITE_NAME} — ${SITE_DESCRIPTION}` }],
        ["meta", { name: "twitter:card", content: "summary_large_image" }],
        ["meta", { name: "twitter:image", content: OG_IMAGE }],
        ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
        [
            "link",
            { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        ],
        [
            "link",
            {
                rel: "stylesheet",
                href: "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,600;0,700;0,800;0,900;1,600;1,700;1,800;1,900&display=swap",
            },
        ],
        [
            "link",
            {
                rel: "stylesheet",
                href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap",
            },
        ],
        [
            "link",
            {
                rel: "stylesheet",
                href: "https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap",
            },
        ],
    ],
});

export default extendConfig(config);
