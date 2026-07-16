// @ts-expect-error: no types for this package
import { extendConfig } from "@voidzero-dev/vitepress-theme/config";
import { type DefaultTheme, defineConfig } from "vitepress";
import { groupIconMdPlugin, groupIconVitePlugin } from "vitepress-plugin-group-icons";

const SITE_URL = "https://pitlane.tools";
const SITE_NAME = "Pitlane";
const SITE_DESCRIPTION = "Platform integration for Remix apps on Cloudflare.";
const OG_IMAGE = `${SITE_URL}/media/pitlane-lockup.png`;

let guides: DefaultTheme.SidebarItem[] = [
    // {
    //     text: "Introduction",
    //     items: [
    //         { text: "Getting Started", link: "/guides/getting-started" },
    //         { text: "Creating a Project", link: "/guides/create" },
    //         { text: "Installing Dependencies", link: "/guides/install" },
    //     ],
    // },
    {
        text: "Guide",
        items: [
            // { text: "Features", link: "/guides/features" },
            // { text: "Routing", link: "/guides/routing" },
            // { text: "Frames", link: "/guides/frames" },
            // { text: "Hydration", link: "/guides/hydration" },
            { text: "Styling", link: "/guides/styling" },
            //     { text: "Pending UI", link: "/guides/pending-ui" },
            //     { text: "Sessions and Cookies", link: "/guides/sessions-cookies" },
            //     { text: "Background Jobs", link: "/guides/jobs" },
            //     { text: "Cron Jobs", link: "/guides/cron" },
            //     { text: "Error Reporting", link: "/guides/errors" },
            //     { text: "File Uploads", link: "/guides/file-uploads" },
            //     { text: "Validation", link: "/guides/validation" },
            //     { text: "Content Layer", link: "/guides/content" },
            //     { text: "Authentication", link: "/guides/auth" },
            //     { text: "Testing", link: "/guides/testing" },
            //     { text: "Pre-Rendering", link: "/guides/pre-rendering" },
            //     { text: "Progressive Enhancement", link: "/guides/progressive-enhancement" },
        ],
    },
    //     {
    //         text: "Tools",
    //         items: [
    //             { text: "Vite+", link: "/guides/vite-plus" },
    //             { text: "Pitlane CLI", link: "/guides/cli" },
    //             { text: "GitHub Actions", link: "/guides/actions" },
    //         ],
    //     },
    //     {
    //         text: "Deploy",
    //         items: [
    //             { text: "Setup", link: "/guides/setup" },
    //             { text: "Environment Variables", link: "/guides/env" },
    //             { text: "Secrets", link: "/guides/secrets" },
    //             { text: "Resources", link: "/guides/resources" },
    //             { text: "Database Migrations", link: "/guides/migrations" },
    //             { text: "Deployment", link: "/guides/deployment" },
    //         ],
    //     },
];

let packages: DefaultTheme.SidebarItem[] = [
    {
        text: "Packages",
        items: [
            //             { text: "pitlane", link: "/package/pitlane" },
            //
            //             {
            //                 text: "@pitlane/data-table-cloudflare-d1",
            //                 link: "/package/data-table-cloudflare-d1",
            //             },
            //             {
            //                 text: "@pitlane/data-table-cloudflare-durable-object-sql",
            //                 link: "/package/data-table-cloudflare-durable-object-sql",
            //             },
            //             {
            //                 text: "@pitlane/data-table-netlify-database",
            //                 link: "/package/data-table-netlify-database",
            //             },
            //             { text: "@pitlane/data-table-neon", link: "/package/data-table-neon" },
            //             {
            //                 text: "@pitlane/file-storage-cloudflare-r2",
            //                 link: "/package/file-storage-cloudflare-r2",
            //             },
            //             {
            //                 text: "@pitlane/file-storage-netlify-blobs",
            //                 link: "/package/file-storage-netlify-blobs",
            //             },
            //             {
            //                 text: "@pitlane/file-storage-vercel-blob",
            //                 link: "/package/file-storage-vercel-blob",
            //             },
            //             {
            //                 text: "@pitlane/session-storage-cloudflare-kv",
            //                 link: "/package/session-storage-cloudflare-kv",
            //             },
            //             {
            //                 text: "@pitlane/session-storage-netlify-blobs",
            //                 link: "/package/session-storage-netlify-blobs",
            //             },
            //             { text: "@pitlane/session-storage-redis", link: "/package/session-storage-redis" },
            //             { text: "@pitlane/auth-netlify-identity", link: "/package/auth-netlify-identity" },
            //             { text: "@pitlane/auth-clerk", link: "/package/auth-clerk" },
            //
            //             { text: "@pitlane/dev", link: "/package/dev" },
            //             { text: "@pitlane/content", link: "/package/content" },
            //             { text: "@pitlane/meta", link: "/package/meta" },
            //             { text: "@pitlane/i18n", link: "/package/i18n" },
            //             { text: "@pitlane/env", link: "/package/env" },
            { text: "@pitlane/theme", link: "/package/theme" },
            //             { text: "@pitlane/sprites", link: "/package/sprites" },
            //             { text: "@pitlane/logger", link: "/package/logger" },
            //             { text: "@pitlane/browser-router", link: "/package/browser-router" },
            //             { text: "@pitlane/typed-routes", link: "/package/typed-routes" },
            //
            //             { text: "@pitlane/image", link: "/package/image" },
            //             { text: "@pitlane/image-cloudflare", link: "/package/image-cloudflare" },
            //             { text: "@pitlane/image-netlify", link: "/package/image-netlify" },
            //             { text: "@pitlane/image-vercel", link: "/package/image-vercel" },
            //
            //             { text: "@pitlane/flags", link: "/package/flags" },
            //             { text: "@pitlane/flags-cloudflare", link: "/package/flags-cloudflare" },
            //             { text: "@pitlane/flags-netlify", link: "/package/flags-netlify" },
            //             { text: "@pitlane/flags-vercel", link: "/package/flags-vercel" },
            //
            //             { text: "@pitlane/job", link: "/package/job" },
            //             { text: "@pitlane/job-storage-data-table", link: "/package/job-storage-data-table" },
            //             {
            //                 text: "@pitlane/job-storage-cloudflare-kv",
            //                 link: "/package/job-storage-cloudflare-kv",
            //             },
            //             { text: "@pitlane/job-storage-redis", link: "/package/job-storage-redis" },
            //             {
            //                 text: "@pitlane/job-scheduler-cloudflare",
            //                 link: "/package/job-scheduler-cloudflare",
            //             },
            //             { text: "@pitlane/job-scheduler-netlify", link: "/package/job-scheduler-netlify" },
            //             { text: "@pitlane/job-scheduler-vercel", link: "/package/job-scheduler-vercel" },
            //
            //             { text: "@pitlane/cache", link: "/package/cache" },
            //             { text: "@pitlane/cache-cloudflare", link: "/package/cache-cloudflare" },
            //             { text: "@pitlane/cache-netlify", link: "/package/cache-netlify" },
            //             { text: "@pitlane/cache-vercel", link: "/package/cache-vercel" },
            //
            //             { text: "@pitlane/realtime", link: "/package/realtime" },
            //             {
            //                 text: "@pitlane/realtime-cloudflare-durable-objects",
            //                 link: "/package/realtime-cloudflare-durable-objects",
            //             },
            //
            //             { text: "@pitlane/email", link: "/package/email" },
            //             { text: "@pitlane/email-cloudflare", link: "/package/email-cloudflare" },
            //             { text: "@pitlane/email-resend", link: "/package/email-resend" },
            //
            //             { text: "@pitlane/fonts", link: "/package/fonts" },
            //             { text: "@pitlane/fonts-adobe", link: "/package/fonts-adobe" },
            //             { text: "@pitlane/fonts-google", link: "/package/fonts-google" },
            //             { text: "@pitlane/fonts-fontsource", link: "/package/fonts-fontsource" },
        ],
    },
];

let config = defineConfig({
    title: SITE_NAME,
    titleTemplate: `:title | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    srcExclude: ["superpowers/**", "internal/**"],
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
        },
    },
    vite: {
        plugins: [groupIconVitePlugin() as any],
    },
    themeConfig: {
        logo: "/favicon.svg",
        socialLinks: [{ icon: "github", link: "https://github.com/pitlane-tools" }],
        outline: { level: "deep" },
        nav: [
            { text: "Guide", link: "/guides/styling", activeMatch: "/guides/" },
            { text: "Packages", link: "/package/theme", activeMatch: "/package/" },
        ],
        sidebar: {
            "/guides/": guides,
            "/package/": packages,
        },
        footer: {
            copyright: `© ${new Date().getFullYear()} Pitlane contributors.`,
        },
    },
    head: [
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
