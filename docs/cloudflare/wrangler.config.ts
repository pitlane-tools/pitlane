import { defineWranglerConfig } from "wrangler/experimental-config";

// cf builds this static-assets Worker through Wrangler, which reads its build
// and dev-server settings from here rather than from cloudflare.config.ts.
export default defineWranglerConfig({
    assetsDirectory: "../dist/client",
    // An ephemeral inspector port lets docs:test run beside another dev server.
    dev: { ip: "127.0.0.1", inspectorPort: 0 },
});
