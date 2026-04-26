import type { Theme } from "vitepress";

import { themeContextKey, VoidZeroTheme } from "@voidzero-dev/vitepress-theme";

import Home from "./layouts/Home.vue";
import "./custom.css";
import "virtual:group-icons.css";

const logoDark = "/logo-light.svg";
const logoLight = "/logo-dark.svg";
const footerBg = "/media/pitlane-race-track-night.png";
const monoIcon = "/favicon.svg";

export default {
    ...VoidZeroTheme,
    enhanceApp(ctx) {
        ctx.app.provide(themeContextKey, {
            logoDark,
            logoLight,
            logoAlt: "Pitlane",
            footerBg,
            monoIcon,
        });

        ctx.app.component("Home", Home);

        VoidZeroTheme.enhanceApp(ctx);
    },
} satisfies Theme;
