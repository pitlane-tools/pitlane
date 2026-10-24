import { cloudflare } from "@cloudflare/vite-plugin-v2";

import { describeCloudflare } from "./cloudflare.suite.ts";

// The 2.0 beta that Cloudflare's cf CLI builds with: configured by
// cloudflare.config.ts, and writing Cloudflare's Build Output instead of dist/.
describeCloudflare({
    fixture: "cloudflare-v2-app",
    cloudflare,
    output: ".cloudflare/output",
    serverEntry: ".cloudflare/output/v0/workers/default/bundle/index.js",
    clientDir: ".cloudflare/output/v0/workers/default/assets",
    devPort: 7323,
    previewPort: 7324,
});
