import { cloudflare } from "@cloudflare/vite-plugin";

import { describeCloudflare } from "./cloudflare.suite.ts";

describeCloudflare({
    fixture: "cloudflare-app",
    cloudflare,
    output: "dist",
    serverEntry: "dist/ssr/index.js",
    clientDir: "dist/client",
    devPort: 7321,
    previewPort: 7322,
});
