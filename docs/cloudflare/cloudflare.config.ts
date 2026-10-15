import { defineConfig } from "cf/config";

// The Worker for pitlane.tools: static assets only, with no Worker code for any
// request. This directory is its own workspace package because cf runs a
// detected framework's build instead of Wrangler, and docs/ is a Vite project.
export default defineConfig({
    accountId: "3e1fe2693d3175f5f65ef46352f4f747",
    worker: {
        // pitlane.tools is attached as a custom domain on the Cloudflare side;
        // it stays out of this config because CI's API token is scoped to
        // Workers only (no zone permissions), and custom domains persist
        // across deploys.
        name: "pitlane",
        compatibilityDate: "2026-04-26",
        previewUrls: true,
        assets: {
            htmlHandling: "auto-trailing-slash",
            notFoundHandling: "404-page",
        },
    },
});
