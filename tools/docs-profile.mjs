import { mkdir, writeFile } from "node:fs/promises";

const account = "3e1fe2693d3175f5f65ef46352f4f747";
const version = "c1dcbcc4-3589-4cc5-a47e-3e073f2f54b6";
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required inside CI.");
await mkdir("profile-results", { recursive: true });

const since = new Date(Date.now() - 2 * 3_600_000).toISOString();
const query = `{
    viewer {
        accounts(filter: {accountTag: ${JSON.stringify(account)}}) {
            workersInvocationsAdaptive(limit: 1000, filter: {
                scriptName: "pitlane",
                scriptVersion: ${JSON.stringify(version)},
                datetime_geq: ${JSON.stringify(since)}
            }) {
                dimensions { scriptName scriptVersion isPreview previewSlug status coloCode }
                sum { requests errors cpuTimeUs wallTime responseBodySize subrequests }
                min { cpuTime wallTime }
                max { cpuTime wallTime memoryUsageBytes }
                quantiles { cpuTimeP50 cpuTimeP90 cpuTimeP95 cpuTimeP99 wallTimeP50 wallTimeP95 }
                avg { sampleInterval }
            }
        }
    }
}`;
const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
    },
    body: JSON.stringify({ query }),
});
const payload = await response.json();
const report = {
    queriedAt: new Date().toISOString(),
    since,
    version,
    status: response.status,
    payload,
};
await writeFile("profile-results/analytics-metrics.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
