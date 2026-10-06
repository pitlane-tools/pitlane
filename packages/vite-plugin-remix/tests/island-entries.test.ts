import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createBuilder } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { clientEntryTransform } from "../src/transform.ts";

let root: string;
let islandChunk: string;

beforeAll(async () => {
    root = await mkdtemp(fileURLToPath(new URL("./.tmp-islands-", import.meta.url)));
    await mkdir(join(root, "app"), { recursive: true });
    await writeFile(
        join(root, "app/counter.ts"),
        `import { clientEntry } from "remix/component";
export let Counter = clientEntry(import.meta.url, function Counter() {
    return () => null;
});
`,
    );
    await writeFile(join(root, "app/entry.server.ts"), 'export { Counter } from "./counter.ts";\n');
    await writeFile(join(root, "app/entry.browser.ts"), 'console.log("browser");\n');

    let builder = await createBuilder({
        root,
        configFile: false,
        logLevel: "silent",
        plugins: [
            clientEntryTransform(new Set(["ssr"])),
            {
                name: "capture-consumable-island-entry",
                writeBundle(_options, bundle) {
                    if (this.environment.name !== "client") return;
                    for (let output of Object.values(bundle)) {
                        if (
                            output.type === "chunk" &&
                            output.isEntry &&
                            output.facadeModuleId === join(root, "app/counter.ts")
                        ) {
                            islandChunk = join(root, "dist/client", output.fileName);
                        }
                    }
                },
            },
        ],
        builder: {
            async buildApp(builder) {
                await builder.build(builder.environments.ssr!);
                await builder.build(builder.environments.client!);
            },
        },
        environments: {
            client: {
                build: {
                    outDir: join(root, "dist/client"),
                    rolldownOptions: { input: join(root, "app/entry.browser.ts") },
                },
            },
            ssr: {
                build: {
                    outDir: join(root, "dist/ssr"),
                    rolldownOptions: { input: { index: join(root, "app/entry.server.ts") } },
                },
            },
        },
    });
    await builder.buildApp();
});

afterAll(async () => {
    await rm(root, { force: true, recursive: true });
});

describe("proposal 0005: islands discovered in server builds", () => {
    it("preserves the same exported island identity in independently importable server and client outputs", async () => {
        let server = await import(pathToFileURL(join(root, "dist/ssr/index.js")).href);
        let client = await import(pathToFileURL(islandChunk).href);
        expect(server.Counter.$entryId).toBe("file:app/counter.ts#Counter");
        expect(client.Counter.$entryId).toBe(server.Counter.$entryId);
        expect(client.Counter()).toBeTypeOf("function");
    });
});
