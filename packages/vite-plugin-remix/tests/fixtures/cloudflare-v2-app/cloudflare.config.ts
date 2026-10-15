import { bindings, defineConfig } from "cf/config";

export default defineConfig({
    worker: {
        name: "pitlane-dev-cloudflare-v2-fixture",
        entrypoint: "app/entry.server.tsx",
        compatibilityDate: "2026-04-02",
        compatibilityFlags: ["nodejs_compat"],
        env: { ASSETS: bindings.assets() },
        assets: { runWorkerFirst: true },
    },
});
