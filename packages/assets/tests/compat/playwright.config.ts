import { defineConfig, devices } from "@playwright/test";

// Every example runs twice: with chunk import maps left at their default
// (disabled) and with `chunkImportMap: true`. The fixture passes the choice to
// each example's Vite config through COMPAT_CHUNK_IMPORT_MAP.
export default defineConfig({
    testDir: "e2e",
    use: {
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        ...devices["Desktop Chrome"],
    },
    projects: [
        { name: "maps-off", metadata: { chunkImportMap: false } },
        { name: "maps-on", metadata: { chunkImportMap: true } },
    ],
    workers: 1,
    fullyParallel: false,
    retries: 0,
    forbidOnly: !!process.env.CI,
    timeout: 60_000,
    reporter: process.env.CI ? [["list"], ["github"]] : "list",
});
