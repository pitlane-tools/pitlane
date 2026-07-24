import type { Theme } from "vitepress";

import { themeContextKey, VoidZeroTheme } from "@voidzero-dev/vitepress-theme";
import { defineComponent, h, onMounted } from "vue";

import Home from "./layouts/Home.vue";
import { applyStoredPackageManager, setupPackageManagerTabs } from "./pm-tabs.ts";
import "./custom.css";
import "virtual:group-icons.css";

const logoDark = "/logo-light.svg";
const logoLight = "/logo-dark.svg";
const footerBg = "/media/pitlane-checkered-flag-day.png";
const monoIcon = "/favicon.svg";

const Layout = defineComponent({
    name: "PitlaneLayout",
    setup() {
        onMounted(applyStoredPackageManager);
        return () => h(VoidZeroTheme.Layout);
    },
});

export default {
    ...VoidZeroTheme,
    Layout,
    enhanceApp(ctx) {
        ctx.app.provide(themeContextKey, {
            logoDark,
            logoLight,
            logoAlt: "Pitlane",
            footerBg,
            monoIcon,
        });

        ctx.app.component("Home", Home);

        if (typeof window !== "undefined") setupPackageManagerTabs(ctx.router);

        VoidZeroTheme.enhanceApp(ctx);
    },
} satisfies Theme;
