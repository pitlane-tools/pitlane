import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

const account = "3e1fe2693d3175f5f65ef46352f4f747";
const version = "4b634b36-1738-4611-b7be-d992effe7320";
const origin = "https://4b634b36-pitlane.mark-malstrom.workers.dev";
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required inside CI.");
await mkdir("profile-results", { recursive: true });

async function api(path, body) {
    const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
        method: body ? "POST" : "GET",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, payload: await response.json() };
}

const settings = await api(`/accounts/${account}/workers/scripts/pitlane/settings`);
await writeFile(
    "profile-results/settings.json",
    JSON.stringify(
        {
            status: settings.status,
            errors: settings.payload.errors,
            usageModel: settings.payload.result?.usage_model,
            limits: settings.payload.result?.limits,
            observability: settings.payload.result?.observability,
        },
        null,
        2,
    ),
);

const routes = [
    "/guides/vite-plugin",
    "/guides/content",
    "/guides/content-no-build",
    "/package/theme/",
    "/package/theme/function/css",
    "/package/theme/interface/ThemedCSSProps",
];
const phases = [];
async function requestSample(path, index) {
    const begin = performance.now();
    try {
        const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(30_000) });
        const headersMs = performance.now() - begin;
        const html = await response.text();
        const fullMs = performance.now() - begin;
        return {
            index,
            status: response.status,
            complete:
                response.status === 200 && html.includes("<article") && html.includes("</html>"),
            bytes: Buffer.byteLength(html),
            headersMs,
            fullMs,
            colo: response.headers.get("cf-ray")?.split("-").at(-1),
            cacheControl: response.headers.get("cache-control"),
        };
    } catch (error) {
        return { index, complete: false, fullMs: performance.now() - begin, error: String(error) };
    }
}

async function measure(path, count, concurrency, label) {
    const started = Date.now();
    const samples = [];
    let next = 0;
    let failures = 0;
    async function worker() {
        while (next < count && failures < 5) {
            const sample = await requestSample(path, next++);
            samples.push(sample);
            if (!sample.complete) failures++;
        }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    const ended = Date.now();
    const phase = {
        label,
        path,
        count,
        concurrency,
        from: new Date(Math.floor(started / 1000) * 1000).toISOString(),
        to: new Date(Math.ceil(ended / 1000) * 1000).toISOString(),
        elapsedMs: ended - started,
        samples: samples.sort((a, b) => a.index - b.index),
    };
    phases.push(phase);
    await writeFile(
        "profile-results/requests.json",
        JSON.stringify({ origin, version, phases }, null, 2),
    );
    console.log(
        JSON.stringify({
            label,
            complete: samples.filter(s => s.complete).length,
            count,
            elapsedMs: ended - started,
        }),
    );
    await setTimeout(2500);
}

for (const [index, path] of routes.entries()) {
    await measure(path, 1, 1, `route-${index}-first-observed`);
    await measure(path, 100, 1, `route-${index}-sequential`);
}
await measure(routes.at(-1), 100, 4, "dense-concurrency-4");
await measure(routes.at(-1), 100, 8, "dense-concurrency-8");

console.log("Allowing 120 seconds for analytics ingestion before the bounded queries.");
await setTimeout(120_000);
for (const phase of phases) {
    const query = `{
        viewer {
            accounts(filter: {accountTag: ${JSON.stringify(account)}}) {
                workersInvocationsAdaptive(limit: 1000, filter: {
                    scriptName: "pitlane",
                    scriptVersion: ${JSON.stringify(version)},
                    datetime_geq: ${JSON.stringify(phase.from)},
                    datetime_lt: ${JSON.stringify(phase.to)}
                }) {
                    dimensions { scriptVersion status coloCode usageModel }
                    sum { requests errors cpuTimeUs wallTime responseBodySize subrequests }
                    min { cpuTime wallTime }
                    max { cpuTime wallTime memoryUsageBytes }
                    quantiles { cpuTimeP50 cpuTimeP90 cpuTimeP95 cpuTimeP99 wallTimeP50 wallTimeP95 }
                    avg { sampleInterval }
                }
            }
        }
    }`;
    const metrics = await api("/graphql", { query });
    await writeFile(
        `profile-results/${phase.label}-cpu.json`,
        JSON.stringify(
            {
                version,
                path: phase.path,
                from: phase.from,
                to: phase.to,
                expectedRequests: phase.samples.length,
                queriedAt: new Date().toISOString(),
                ...metrics,
            },
            null,
            2,
        ),
    );
    console.log(JSON.stringify({ label: phase.label, ...metrics }));
}
