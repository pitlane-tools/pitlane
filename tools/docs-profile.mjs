import { mkdir, writeFile } from "node:fs/promises";

const account = "3e1fe2693d3175f5f65ef46352f4f747";
const version = "c1dcbcc4-3589-4cc5-a47e-3e073f2f54b6";
const token = process.env.CLOUDFLARE_API_TOKEN;
const output = "profile-results";
if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required inside CI.");
await mkdir(output, { recursive: true });

async function api(label, path, body) {
    const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
        method: body ? "POST" : "GET",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();
    const errors = payload.errors ?? null;
    console.log(JSON.stringify({ label, status: response.status, errors }));
    return { status: response.status, payload };
}

const metadata = await api(
    "version",
    `/accounts/${account}/workers/scripts/pitlane/versions/${version}`,
);
const resource = metadata.payload.result;
await writeFile(
    `${output}/version.json`,
    JSON.stringify(
        {
            status: metadata.status,
            errors: metadata.payload.errors,
            id: resource?.id,
            createdOn: resource?.metadata?.created_on,
            script: resource?.resources?.script,
            observability: resource?.resources?.observability,
        },
        null,
        2,
    ),
);

const schema = await api("analytics-schema", "/graphql", {
    query: "{ __schema { types { name } } }",
});
const names =
    schema.payload.data?.__schema?.types
        ?.map(type => type.name)
        .filter(name => /workersInvocationsAdaptive/i.test(name)) ?? [];
console.log(JSON.stringify({ analyticsTypes: names }));
await writeFile(
    `${output}/analytics-access.json`,
    JSON.stringify(
        {
            status: schema.status,
            errors: schema.payload.errors,
            types: names,
        },
        null,
        2,
    ),
);
if (names.length) {
    const fields = names
        .map(
            (name, index) =>
                `t${index}: __type(name: ${JSON.stringify(name)}) { name fields { name description } inputFields { name description } }`,
        )
        .join("\n");
    const details = await api("analytics-fields", "/graphql", { query: `{ ${fields} }` });
    await writeFile(`${output}/analytics-schema.json`, JSON.stringify(details, null, 2));
}

const now = Date.now();
const logs = await api(
    "observability-access",
    `/accounts/${account}/workers/observability/telemetry/query`,
    {
        queryId: "pitlane-cpu-headroom-access",
        timeframe: { from: now - 3_600_000, to: now },
        view: "calculations",
        dry: true,
        parameters: {
            filters: [
                { key: "$workers.scriptName", operation: "eq", type: "string", value: "pitlane" },
            ],
            calculations: [{ operator: "count", alias: "invocations" }],
            filterCombination: "and",
        },
    },
);
await writeFile(`${output}/observability-access.json`, JSON.stringify(logs, null, 2));
