// Dev-server harness. Boots a real Vite dev server with fetchServer() in its
// own process — the way users run Vite — and keeps it running. It prints one
// machine-readable line on stdout:
//
//     fetch-server-harness ready <origin>
//     fetch-server-harness failed <json-encoded error message>
//
// Vite's own logger writes to stderr, so the development error path stays
// observable to the test that spawned it.
//
// Usage: node dev-server.ts '<spec-json>'
import { createServer, DevEnvironment, type UserConfig } from "vite";

import type { HarnessSpec } from "../harness.ts";

import { fetchServer, type FetchServerOptions } from "../../src/index.ts";

let spec: HarnessSpec = JSON.parse(process.argv[2] ?? "");

let environments: NonNullable<UserConfig["environments"]> = {};
if (spec.ssrInput !== undefined) {
    environments.ssr = { build: { rolldownOptions: { input: spec.ssrInput } } };
}
for (let name of spec.runnableEnvironments ?? []) {
    environments[name] = {};
}
for (let name of spec.nonRunnableEnvironments ?? []) {
    environments[name] = {
        dev: {
            createEnvironment: (environmentName, config) =>
                new DevEnvironment(environmentName, config, { hot: false }),
        },
    };
}

try {
    // The spec's plugin options are deliberately unchecked: the suite passes
    // omitted and empty entries to observe how the plugin rejects them.
    let options: FetchServerOptions = spec.plugin as FetchServerOptions;

    let server = await createServer({
        configFile: false,
        root: spec.root,
        cacheDir: spec.cacheDir,
        base: spec.base,
        appType: spec.appType,
        logLevel: "error",
        environments,
        server: { host: "127.0.0.1", port: 0 },
        plugins: [fetchServer(options)],
    });
    await server.listen();

    let address = server.httpServer?.address();
    if (address === null || address === undefined || typeof address === "string") {
        throw new Error("the dev server is not listening on a TCP port");
    }
    console.log(`fetch-server-harness ready http://127.0.0.1:${address.port}`);

    let shutdown = async () => {
        await server.close().catch(() => {});
        process.exit(0);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
} catch (error) {
    let message = error instanceof Error ? error.message : String(error);
    console.log(`fetch-server-harness failed ${JSON.stringify(message)}`);
    process.exit(1);
}
