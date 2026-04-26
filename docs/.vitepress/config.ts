// deno-lint-ignore-file no-explicit-any
import { DefaultTheme, defineConfig } from 'vitepress';
import { groupIconMdPlugin, groupIconVitePlugin } from 'vitepress-plugin-group-icons';
import { extendConfig } from '@voidzero-dev/vitepress-theme/config';

const guides: DefaultTheme.SidebarItem[] = [
    {
        text: 'Introduction',
        items: [
            { text: 'Getting Started', link: '/guides/getting-started' },
        ],
    },
];

const config = defineConfig({
    title: 'My Project',
    markdown: {
        theme: {
            dark: 'github-dark',
            light: 'github-light',
        },
        config(md) {
            md.use(groupIconMdPlugin);
        },
    },
    vite: {
        plugins: [groupIconVitePlugin() as any],
    },
    themeConfig: {
        logo: '/favicon.svg',
        socialLinks: [
            { icon: 'github', link: 'https://github.com/' },
        ],
        outline: { level: 'deep' },
        nav: [
            { text: 'Guides', link: '/guides/getting-started', activeMatch: '/guides/' },
        ],
        sidebar: {
            '/guides/': guides,
        },
    },
    head: [
        ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
        ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
        [
            'link',
            { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
        ],
        [
            'link',
            {
                rel: 'stylesheet',
                href:
                    'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,600;0,700;0,800;0,900;1,600;1,700;1,800;1,900&display=swap',
            },
        ],
        [
            'link',
            {
                rel: 'stylesheet',
                href:
                    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap',
            },
        ],
        [
            'link',
            {
                rel: 'stylesheet',
                href:
                    'https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap',
            },
        ],
    ],
});

export default extendConfig(config);
