import { h } from 'vue';
import type { Theme } from 'vitepress';
import { themeContextKey, VoidZeroTheme } from '@voidzero-dev/vitepress-theme';
import footerBg from '@voidzero-dev/vitepress-theme/src/assets/vitest/footer-background.jpg';
import monoIcon from '@voidzero-dev/vitepress-theme/src/assets/icons/vitest-mono.svg';
import Home from './layouts/Home.vue';
import './custom.css';
import 'virtual:group-icons.css';

const logoDark = '/logo-dark.svg';
const logoLight = '/logo-light.svg';

export default {
    ...VoidZeroTheme,
    Layout() {
        return h((VoidZeroTheme as any).Layout, null, {
            'home-hero-before': () => h(Home),
        });
    },
    enhanceApp(ctx) {
        ctx.app.provide(themeContextKey, {
            logoDark,
            logoLight,
            logoAlt: 'Pitlane',
            footerBg,
            monoIcon,
        });

        VoidZeroTheme.enhanceApp(ctx);
    },
} satisfies Theme;
