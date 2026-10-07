import type { ViteDevServer } from "vite";

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, isRunnableDevEnvironment } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { remix } from "../src/index.ts";

const ISLAND = `import { clientEntry } from "remix/component";
export let Counter = clientEntry(import.meta.url, function Counter() {
    return () => null;
});
`;

let root: string;
let server: ViteDevServer;

beforeAll(async () => {
    root = await mkdtemp(fileURLToPath(new URL("./.tmp-registration-", import.meta.url)));
    await mkdir(join(root, "app"), { recursive: true });
    await writeFile(
        join(root, "app/assets.ts"),
        `import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
export let assets = createAssetResolver(manifest);
`,
    );
    await writeFile(join(root, "app/island.ts"), ISLAND);
    await writeFile(join(root, "app/plain.ts"), 'export let plain = "plain";\n');
    await writeFile(
        join(root, "app/entry.server.ts"),
        `export { assets } from "./assets.ts";
export { Counter } from "./island.ts";
export { plain } from "./plain.ts";
`,
    );
    await writeFile(join(root, "app/entry.browser.ts"), 'console.log("browser");\n');

    server = await createServer({
        root,
        configFile: false,
        logLevel: "silent",
        appType: "custom",
        // Native macOS events can report fixture writes late; polling sees the edit.
        server: { watch: { usePolling: true } },
        plugins: [remix({ serverHandler: false })],
    });
    await server.listen();
});

afterAll(async () => {
    await server?.close();
    await rm(root, { force: true, recursive: true });
});

/** Imports the server entry per request, as the Fetch server bridge does. */
async function resolver() {
    let ssr = server.environments.ssr;
    if (!ssr || !isRunnableDevEnvironment(ssr))
        throw new Error("Expected runnable SSR environment");
    let entry = await ssr.runner.import("/app/entry.server.ts");
    return entry.assets as { getScriptEntry(key: string): Promise<{ href: string }> };
}

async function scriptEntry(key: string): Promise<string> {
    return (await resolver()).getScriptEntry(key).then(
        entry => entry.href,
        () => "unregistered",
    );
}

describe("proposal 0005: dev island registration through remix()", () => {
    it("lists a declared island as a browser entry and drops it once the module stops declaring it", async () => {
        expect(await scriptEntry("app/island.ts")).toBe("/app/island.ts");
        // A server module that never declared an island is not a browser entry.
        await expect((await resolver()).getScriptEntry("app/plain.ts")).rejects.toThrow(
            "app/plain.ts",
        );

        await writeFile(join(root, "app/island.ts"), 'export let Counter = "gone";\n');

        await expect
            .poll(() => scriptEntry("app/island.ts"), { timeout: 10_000 })
            .toBe("unregistered");
        await expect((await resolver()).getScriptEntry("app/island.ts")).rejects.toThrow(
            "app/island.ts",
        );
    });
});
