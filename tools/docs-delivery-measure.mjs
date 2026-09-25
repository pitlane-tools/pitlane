import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

let [origin, version, manifestPath, outputPath] = process.argv.slice(2);
if (!origin || !version || !manifestPath || !outputPath)
    throw new Error("Expected origin, version UUID, manifest JSON, output directory");
let token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required");
let account = "3e1fe2693d3175f5f65ef46352f4f747";
let cases = JSON.parse(await readFile(manifestPath, "utf8"));
let directory = resolve(outputPath);
await mkdir(directory, { recursive: true });
let sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
let save = (name, value) => writeFile(resolve(directory, name), JSON.stringify(value, null, 2));
let windows = [];

async function request(specification, phase, sample) {
    let started = performance.now();
    let status = 0;
    let text = "";
    let probeHeaders = {};
    let error;
    try {
        let response = await fetch(new URL(specification.path, origin), {
            headers: { "Cache-Control": "no-cache", ...specification.headers },
            signal: AbortSignal.timeout(30000),
        });
        status = response.status;
        text = await response.text();
        probeHeaders = Object.fromEntries(
            ["content-type", "cache-control", "etag", "cf-cache-status", "cf-ray"].map(name => [
                name,
                response.headers.get(name),
            ]),
        );
    } catch (caught) {
        error = String(caught);
    }
    let elapsed = performance.now() - started;
    let bytes = Buffer.byteLength(text);
    let sha256 = createHash("sha256").update(text).digest("hex");
    let complete =
        !error &&
        status === 200 &&
        (!specification.suffix || text.endsWith(specification.suffix)) &&
        (specification.bytes === undefined || bytes === specification.bytes) &&
        (!specification.sha256 || sha256 === specification.sha256);
    if (sample === 0 || !complete) {
        await writeFile(resolve(directory, `${specification.id}-${phase}-${sample}.html`), text);
    }
    return { sample, status, complete, bytes, sha256, wallMs: elapsed, probeHeaders, error };
}

async function measure(specification, phase, count) {
    await sleep(2200);
    let start = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
    let samples = [];
    let failures = 0;
    for (let index = 0; index < count; index++) {
        let sample = await request(specification, phase, index);
        samples.push(sample);
        if (!sample.complete && ++failures >= 3) break;
    }
    let end = new Date(Math.ceil(Date.now() / 1000) * 1000).toISOString();
    let window = { id: specification.id, path: specification.path, phase, start, end, samples };
    windows.push(window);
    await save("windows.json", { origin, version, cases, windows });
    console.log(
        `${specification.id} ${phase}: ${samples.filter(sample => sample.complete).length}/${samples.length} complete`,
    );
}

for (let specification of cases) {
    if (
        !/^[a-z0-9-]+$/.test(specification.id) ||
        !specification.path ||
        (!specification.suffix && !specification.sha256)
    ) {
        throw new Error(`Invalid case manifest: ${JSON.stringify(specification)}`);
    }
    await measure(specification, "first-observed", 1);
    await sleep(2200);
    for (let index = 0; index < 3; index++) await request(specification, "warmup", index);
    await measure(specification, "warm", 30);
}

console.log("Waiting 120 seconds for analytics ingestion");
await sleep(120000);
let telemetry = [];
for (let window of windows) {
    let filter = JSON.stringify({
        scriptName: "pitlane",
        scriptVersion: version,
        datetime_geq: window.start,
        datetime_lt: window.end,
    }).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");
    let query = `{ viewer { accounts(filter: { accountTag: "${account}" }) {
        workersInvocationsAdaptive(limit: 1000, filter: ${filter}) {
            dimensions { scriptVersion status coloCode usageModel }
            sum { requests errors cpuTimeUs wallTime responseBodySize subrequests }
            min { cpuTime wallTime }
            max { cpuTime wallTime memoryUsageBytes }
            quantiles { cpuTimeP50 cpuTimeP90 cpuTimeP95 cpuTimeP99 wallTimeP50 wallTimeP95 }
            avg { sampleInterval }
        }
    } } }`;
    let response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
    });
    let payload = await response.json();
    telemetry.push({
        id: window.id,
        phase: window.phase,
        start: window.start,
        end: window.end,
        status: response.status,
        payload,
    });
    await save("telemetry.json", { origin, version, telemetry });
    if (!response.ok || payload.errors?.length)
        throw new Error(`Analytics failed: ${JSON.stringify(payload.errors ?? payload)}`);
}
console.log(`Collected ${telemetry.length} isolated telemetry windows`);
