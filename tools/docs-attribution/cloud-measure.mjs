import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [origin, version, manifestPath, outputPath] = process.argv.slice(2);
if (!origin || !version || !manifestPath || !outputPath)
    throw new Error("Expected origin, version UUID, manifest JSON, output directory");
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required");
const account = "3e1fe2693d3175f5f65ef46352f4f747";
const cases = JSON.parse(await readFile(manifestPath, "utf8"));
const directory = resolve(outputPath);
await mkdir(directory, { recursive: true });
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const save = (name, value) => writeFile(resolve(directory, name), JSON.stringify(value, null, 2));
const windows = [];

async function request(specification, phase, sample) {
    const started = performance.now();
    let status = 0;
    let text = "";
    let probeHeaders = {};
    let error;
    try {
        const response = await fetch(new URL(specification.path, origin), {
            headers: { "Cache-Control": "no-cache", ...(specification.headers ?? {}) },
            signal: AbortSignal.timeout(30000),
        });
        status = response.status;
        text = await response.text();
        probeHeaders = Object.fromEntries(
            ["x-probe-case", "x-probe-n", "x-probe-isolate", "x-probe-cold", "x-probe-seq"].map(
                name => [name, response.headers.get(name)],
            ),
        );
    } catch (caught) {
        error = String(caught);
    }
    const elapsed = performance.now() - started;
    const bytes = Buffer.byteLength(text);
    const sha256 = createHash("sha256").update(text).digest("hex");
    const complete =
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
    const start = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
    const samples = [];
    let failures = 0;
    for (let index = 0; index < count; index++) {
        const sample = await request(specification, phase, index);
        samples.push(sample);
        if (!sample.complete && ++failures >= 3) break;
    }
    const end = new Date(Math.ceil(Date.now() / 1000) * 1000).toISOString();
    const window = { id: specification.id, path: specification.path, phase, start, end, samples };
    windows.push(window);
    await save("windows.json", { origin, version, cases, windows });
    console.log(
        `${specification.id} ${phase}: ${samples.filter(sample => sample.complete).length}/${samples.length} complete`,
    );
}

for (const specification of cases) {
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
const telemetry = [];
for (const window of windows) {
    const filter = JSON.stringify({
        scriptName: "pitlane",
        scriptVersion: version,
        datetime_geq: window.start,
        datetime_lt: window.end,
    }).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, "$1:");
    const query = `{ viewer { accounts(filter: { accountTag: "${account}" }) {
        workersInvocationsAdaptive(limit: 1000, filter: ${filter}) {
            dimensions { scriptVersion status coloCode usageModel }
            sum { requests errors cpuTimeUs wallTime responseBodySize subrequests }
            min { cpuTime wallTime }
            max { cpuTime wallTime memoryUsageBytes }
            quantiles { cpuTimeP50 cpuTimeP90 cpuTimeP95 cpuTimeP99 wallTimeP50 wallTimeP95 }
            avg { sampleInterval }
        }
    } } }`;
    const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
    });
    const payload = await response.json();
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
