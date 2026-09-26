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
    { command: "cd my-app && vp install", split: 5500, result: "Installed" },
    { command: "vp run dev", split: 1650, result: "Dev server up" },
    { command: "vp build", split: 12750, result: "Built" },
];
