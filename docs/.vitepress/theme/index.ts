import type { Theme } from "vitepress";

import { themeContextKey, VoidZeroTheme } from "@voidzero-dev/vitepress-theme";
import CopyOrDownloadAsMarkdownButtons from "vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue";

import Guide from "./layouts/Guide.vue";
import Home from "./layouts/Home.vue";
import "./custom.css";
import "virtual:group-icons.css";

let logoDark = "/logo-light.svg";
let logoLight = "/logo-dark.svg";
let footerBg = "/media/pitlane-checkered-flag-day.png";
let monoIcon = "/favicon.svg";

export default {
    ...VoidZeroTheme,
    Layout: Guide,
    enhanceApp(ctx) {
        ctx.app.provide(themeContextKey, {
            logoDark,
            logoLight,
            logoAlt: "Pitlane",
            footerBg,
            monoIcon,
        });

        ctx.app.component("Home", Home);
        ctx.app.component("CopyOrDownloadAsMarkdownButtons", CopyOrDownloadAsMarkdownButtons);

        VoidZeroTheme.enhanceApp(ctx);
    },
} satisfies Theme;
