import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const directory = resolve(".docs/dist/ssr");
const output = resolve(process.env.ATTRIBUTION_OUTPUT ?? "attribution-results");
await mkdir(output, { recursive: true });
for (const name of ["probe.js", "probe-current.js"]) {
    await copyFile(resolve("tools/docs-attribution", name), resolve(directory, name));
}
const { default: probe } = await import(pathToFileURL(resolve(directory, "probe-current.js")).href);
const invoke = path => probe.fetch(new Request(`https://probe.invalid${path}`), {});
const manifest = await (await invoke("/probe/_manifest")).json();
const selected = new Set([
    "floor",
    "floor-html",
    "router",
    "router-cookie",
    "render-min-direct",
    "render-min-stream",
    "render-min",
    "shell-nav",
    "outline-plain",
    "outline-remixcss",
    "outline-themecss",
    "outline-tva",
    "style-frozen",
    "style-fresh",
    "page",
    "page-prepared",
]);
const cases = manifest.cases
    .filter(specification => selected.has(specification.id))
    .flatMap(specification =>
        specification.n.map(n => ({
            id: `${specification.id}-${n}`,
            path: `/probe/${specification.id}?n=${n}`,
            n,
            comparison: specification,
        })),
    )
    .sort((left, right) => left.n - right.n);
cases.push(
    { id: "current-guide", path: "/current/guides/content" },
    { id: "current-dense", path: "/current/package/theme/interface/ThemedCSSProps" },
    { id: "floor-end", path: "/probe/floor?n=0" },
);
for (const specification of cases) {
    const response = await invoke(specification.path);
    const body = await response.text();
    if (response.status !== 200)
        throw new Error(
            `${specification.id} expected 200, received ${response.status}: ${body.slice(0, 200)}`,
        );
    specification.bytes = Buffer.byteLength(body);
    specification.sha256 = createHash("sha256").update(body).digest("hex");
    await writeFile(resolve(output, `${specification.id}-expected.html`), body);
}
await writeFile(resolve(output, "manifest.json"), JSON.stringify(cases, null, 2));
await writeFile(resolve(output, "fixture-manifest.json"), JSON.stringify(manifest, null, 2));
const info = await (await invoke("/probe/_info")).json();
if (!info.styleReconstructionMatchesDeployedSite)
    throw new Error("Reconstructed style classes do not match the site");
await writeFile(resolve(output, "node-info.json"), JSON.stringify(info, null, 2));
console.log(`Validated ${cases.length} request bodies against the actual built runtime`);
if (process.argv.includes("--prepare-only")) process.exit(0);
const config = {
    name: "pitlane",
    account_id: "3e1fe2693d3175f5f65ef46352f4f747",
    main: "probe-current.js",
    compatibility_date: "2026-04-26",
    compatibility_flags: ["nodejs_compat"],
    preview_urls: true,
    assets: { directory: "../client", binding: "ASSETS", not_found_handling: "none" },
};
const configPath = resolve(directory, "wrangler.attribution.json");
await writeFile(configPath, JSON.stringify(config, null, 2));
const upload = spawnSync(
    "pnpm",
    [
        "exec",
        "wrangler",
        "versions",
        "upload",
        "--config",
        configPath,
        "--message",
        `Controlled attribution ${process.env.GITHUB_SHA?.slice(0, 7) ?? "local"}`,
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
const uploadLog = `${upload.stdout ?? ""}\n${upload.stderr ?? ""}`;
await writeFile(resolve(output, "upload.log"), uploadLog);
console.log(uploadLog);
if (upload.status !== 0) throw new Error(`Version upload failed: ${upload.status}`);
const version = uploadLog.match(/Worker Version ID:\s*([a-f0-9-]+)/i)?.[1];
const origin = uploadLog.match(/Version Preview URL:\s*(https:\/\/[^\s]+)/i)?.[1];
if (!version || !origin)
    throw new Error("Version upload did not identify the immutable preview URL");
await writeFile(resolve(output, "deployment.json"), JSON.stringify({ origin, version }, null, 2));
const response = await fetch(new URL("/probe/_info", origin));
const remoteInfo = await response.json();
await writeFile(resolve(output, "cloud-info.json"), JSON.stringify(remoteInfo, null, 2));
if (!response.ok || !remoteInfo.styleReconstructionMatchesDeployedSite)
    throw new Error("Remote probe validation failed");
const measured = spawnSync(
    process.execPath,
    [
        "tools/docs-attribution/cloud-measure.mjs",
        origin,
        version,
        resolve(output, "manifest.json"),
        output,
    ],
    { stdio: "inherit" },
);
if (measured.status !== 0) throw new Error(`Measurement failed: ${measured.status}`);
