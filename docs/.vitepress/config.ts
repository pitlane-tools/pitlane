// deno-lint-ignore-file no-explicit-any
import { extendConfig } from "@voidzero-dev/vitepress-theme/config";
import { DefaultTheme, defineConfig } from "vitepress";
import { groupIconMdPlugin, groupIconVitePlugin } from "vitepress-plugin-group-icons";

const SITE_URL = "https://pitlane.tools";
const SITE_NAME = "Pitlane";
const SITE_DESCRIPTION = "Platform integration for Remix apps on Cloudflare.";
const OG_IMAGE = `${SITE_URL}/media/pitlane-lockup.png`;

const guides: DefaultTheme.SidebarItem[] = [
    {
        text: "Introduction",
        items: [
            { text: "Getting Started", link: "/guides/getting-started" },
            { text: "Creating a Project", link: "/guides/create" },
            { text: "Installing Dependencies", link: "/guides/install" },
        ],
    },
    {
        text: "Guide",
        items: [
            { text: "Features", link: "/guides/features" },
            { text: "Routing", link: "/guides/routing" },
            { text: "Frames", link: "/guides/frames" },
            { text: "Hydration", link: "/guides/hydration" },
            { text: "Styling", link: "/guides/styling" },
            { text: "Pending UI", link: "/guides/pending-ui" },
            { text: "Sessions and Cookies", link: "/guides/sessions-cookies" },
            { text: "Background Jobs", link: "/guides/jobs" },
            { text: "Cron Jobs", link: "/guides/cron" },
            { text: "Error Reporting", link: "/guides/errors" },
            { text: "File Uploads", link: "/guides/file-uploads" },
            { text: "Validation", link: "/guides/validation" },
            { text: "Content Layer", link: "/guides/content" },
            { text: "Authentication", link: "/guides/auth" },
            { text: "Testing", link: "/guides/testing" },
            { text: "Pre-Rendering", link: "/guides/pre-rendering" },
            { text: "Progressive Enhancement", link: "/guides/progressive-enhancement" },
        ],
    },
    {
        text: "Tools",
        items: [
            { text: "Vite+", link: "/guides/vite-plus" },
            { text: "Pitlane CLI", link: "/guides/cli" },
            { text: "Pitlane MCP", link: "/guides/mcp" },
            { text: "GitHub Actions", link: "/guides/actions" },
        ],
    },
    {
        text: "Deploy",
        items: [
            { text: "Setup", link: "/guides/setup" },
            { text: "Environment Variables", link: "/guides/env" },
            { text: "Secrets", link: "/guides/secrets" },
            { text: "Resources", link: "/guides/resources" },
            { text: "Database Migrations", link: "/guides/migrations" },
            { text: "Deployment", link: "/guides/deployment" },
        ],
    },
];

const packages: DefaultTheme.SidebarItem[] = [
    {
        text: "Packages",
        items: [
            { text: "pitlane", link: "/package/pitlane" },
            { text: "@pitlane/dev", link: "/package/dev" },

            { text: "@pitlane/session-storage", link: "/package/session-storage" },
            { text: "@pitlane/data-table-d1", link: "/package/data-table-d1" },
            { text: "@pitlane/data-table-middleware", link: "/package/data-table-middleware" },
            { text: "@pitlane/file-storage-r2", link: "/package/file-storage-r2" },
            { text: "@pitlane/file-storage-middleware", link: "/package/file-storage-middleware" },
            { text: "@pitlane/job", link: "/package/job" },
            { text: "@pitlane/job-middleware", link: "/package/job-middleware" },
        ],
    },
];

const sidebar: DefaultTheme.SidebarItem[] = [
    {
        text: "Start",
        items: [
            { text: "Getting Started", link: "/guides/getting-started" },
            { text: "Vite+", link: "/guides/vite-plus" },
        ],
    },
    {
        text: "Build",
        items: [
            { text: "Configuration", link: "/guides/configuration" },
            { text: "Platform Primitives", link: "/guides/platform-primitives" },
            { text: "Scaffolding", link: "/guides/scaffolding" },
        ],
    },
    {
        text: "Ship",
        items: [
            { text: "CLI", link: "/guides/cli" },
            { text: "Deployment", link: "/guides/deployment" },
        ],
    },
];

const config = defineConfig({
    title: SITE_NAME,
    titleTemplate: `:title | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    srcExclude: ["superpowers/**"],
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
        plugins: [groupIconVitePlugin() as any],
    },
    themeConfig: {
        logo: "/favicon.svg",
        socialLinks: [{ icon: "github", link: "https://github.com/pitlane-tools" }],
        outline: { level: "deep" },
        nav: [
            { text: "Guide", link: "/guides/getting-started", activeMatch: "/guides/" },
            { text: "Packages", link: "/package/platform", activeMatch: "/package/" },
        ],
        sidebar: {
            "/guides/": guides,
            "/package/": packages,
        },
        footer: {
            copyright: `© ${new Date().getFullYear()} Pitlane. Released under the MIT License.`,
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
