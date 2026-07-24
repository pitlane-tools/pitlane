import { cloudflare } from "@cloudflare/vite-plugin";

import { remix } from "../../../src/index.ts";

declare global {
    // Test hook: the e2e suite asserts every environment builds exactly once
    // when remix() composes with another build orchestrator.
    var __envBuilds: string[] | undefined;
}

export default {
    plugins: [
        remix({ serverHandler: false }),
        cloudflare({ viteEnvironment: { name: "ssr" } }),
        {
            name: "test-env-build-counter",
            buildStart() {
                globalThis.__envBuilds ??= [];
                globalThis.__envBuilds.push(this.environment.name);
            },
        },
    ],
};
