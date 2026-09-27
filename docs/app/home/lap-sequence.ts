export type Sector = { command: string; split: number; result: string };

/**
 * The Cloudflare template's first lap, in the order a reader types it. The
 * splits, in milliseconds, pace the display and measure nothing.
 */
export const SECTORS: readonly Sector[] = [
    {
        command: "vpx giget github:pitlane-tools/templates/cloudflare my-app",
        split: 1800,
        result: "Scaffolded",
    },
    { command: "cd my-app && vp install", split: 6000, result: "Installed" },
    { command: "vpx wrangler d1 create my-app-db", split: 4800, result: "Provisioned" },
    { command: "vp run dev", split: 1650, result: "Running at :1612" },
    { command: "git push && gh run watch 18374291056", split: 12750, result: "Deployed" },
];
