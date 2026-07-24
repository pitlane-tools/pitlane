// @ts-expect-error: no types for this package
import { extendConfig } from "@voidzero-dev/vitepress-theme/config";
import { defineConfig } from "vitepress";
import { groupIconMdPlugin, groupIconVitePlugin, localIconLoader } from "vitepress-plugin-group-icons";

import { pmTabsInlineScript } from "./pm-tabs.ts";

const SITE_URL = "https://pitlane.tools";
const SITE_NAME = "Pitlane";
const SITE_DESCRIPTION = "Portable platform integration for Remix 3.";
const OG_IMAGE = `${SITE_URL}/media/pitlane-lockup.png`;

// Sidebar sections for unreleased packages live in git history; they return
// as their packages ship. The published site documents released surface only.
// (The pre-release Cloudflare-era guides sit in docs/internal/legacy-guides.)

// Shared by /guides/ and /deploy/ so both prefixes present one "Guides"
// section: general usage guides first, deployment guides under Deploy.
const guides = [
    {
        text: "Guides",
        items: [{ text: "Vite Plugin", link: "/guides/vite-plugin" }],
    },
    {
        text: "Deploy",
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

const config = defineConfig({
    title: SITE_NAME,
    titleTemplate: `:title | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    srcExclude: ["superpowers/**", "internal/**"],
    sitemap: { hostname: SITE_URL },
    transformPageData(pageData) {
        const slug = pageData.relativePath.replace(/index\.md$/, "").replace(/\.md$/, "");
        const url = `${SITE_URL}/${slug}`;
        const title = pageData.frontmatter.title ?? pageData.title ?? SITE_NAME;
        const ogTitle = title === SITE_NAME ? SITE_NAME : `${title} | ${SITE_NAME}`;
        const description =
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
        },
    },
    vite: {
        plugins: [
            groupIconVitePlugin({
                customIcon: {
                    vp: localIconLoader(import.meta.url, "../public/icons/vp.svg"),
                    vlt: localIconLoader(import.meta.url, "../public/icons/vlt.svg"),
                    nub: localIconLoader(import.meta.url, "../public/icons/nub.svg"),
                },
            }),
        ],
    },
    themeConfig: {
        logo: "/favicon.svg",
        socialLinks: [{ icon: "github", link: "https://github.com/pitlane-tools" }],
        outline: { level: "deep" },
        nav: [
            { text: "Packages", link: "/package/dev/", activeMatch: "/package/" },
            { text: "Guides", link: "/guides/vite-plugin", activeMatch: "^/(guides|deploy)/" },
        ],
        sidebar: {
            "/package/": [
                { text: "@pitlane/dev", link: "/package/dev/" },
                { text: "@pitlane/dev/runtime", link: "/package/dev/@pitlane/dev/runtime" },
            ],
            "/guides/": guides,
            "/deploy/": guides,
        },
        footer: {
            copyright: `© ${new Date().getFullYear()} Pitlane contributors.`,
        },
    },
    head: [
        // Runs before the body streams in so stored package-manager tabs
        // apply before first paint - no flash of the default tab.
        ["script", {}, pmTabsInlineScript],
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
