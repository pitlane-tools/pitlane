// Proposal 0005, "Standalone Vite Fetch server": fetchServer({ entry,
// environment? }) sends Vite development requests to the default `fetch` of
// an explicitly named server module, loaded through the environment's module
// runner. Every dev server here is real and listens on HTTP; requests come
// from the test process.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveConfig } from "vite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { fetchServer } from "../src/index.ts";
import {
    copyFixture,
    type DevServer,
    type FixtureCopy,
    startDevServer,
    startupError,
    waitFor,
} from "./harness.ts";

const ENTRY = "server/http.ts";

describe("proposal 0005: fetchServer request bridge", () => {
    let fixture: FixtureCopy;
    let server: DevServer;

    beforeAll(async () => {
        fixture = await copyFixture();
        server = await startDevServer({ ...fixture, plugin: { entry: ENTRY } });
    });

    afterAll(async () => {
        await server?.close();
        await fixture?.remove();
    });

    it("sends requests Vite does not serve itself to the entry's fetch handler", async () => {
        let response = await fetch(`${server.origin}/no/such/page`);

        expect(response.status).toBe(404);
        expect(await response.text()).toBe("not found from fixture");
    });

    it("calls fetch with the default export as its receiver", async () => {
        let response = await fetch(`${server.origin}/receiver`);

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("fixture-handler");
    });

    it.each(["POST", "PUT", "DELETE"])(
        "preserves the URL, %s method, headers, and body of a request",
        async method => {
            let response = await fetch(`${server.origin}/echo?x=1&y=two`, {
                method,
                headers: { "x-fixture": "sent" },
                body: `payload for ${method}`,
            });

            expect(await response.json()).toEqual({
                method,
                url: `${server.origin}/echo?x=1&y=two`,
                body: `payload for ${method}`,
                header: "sent",
            });
        },
    );

    it("does not trust forwarded host or protocol headers", async () => {
        let response = await fetch(`${server.origin}/echo`, {
            headers: {
                "x-forwarded-host": "attacker.example",
                "x-forwarded-proto": "https",
                forwarded: "host=attacker.example;proto=https",
            },
        });

        let echoed: { url: string } = await response.json();
        expect(echoed.url).toBe(`${server.origin}/echo`);
    });

    it("preserves the response status, status text, and repeated headers", async () => {
        let response = await fetch(`${server.origin}/created`);

        expect(response.status).toBe(201);
        expect(response.statusText).toBe("Made");
        expect(response.headers.get("x-fixture")).toBe("created");
        expect(response.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
        expect(await response.text()).toBe("made");
    });

    it("streams a response body before the handler finishes it", async () => {
        let response = await fetch(`${server.origin}/stream`);
        let reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();

        // The handler holds the stream open until /stream/release, so this
        // first read only completes when the bridge forwards chunks as they
        // are produced rather than buffering the whole body.
        let first = await reader.read();
        expect(first.value).toBe("first\n");

        let release = await fetch(`${server.origin}/stream/release`);
        expect(release.status).toBe(204);

        let rest = "";
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
            rest += chunk.value;
        }
        expect(rest).toBe("second\n");
    });

    it("closes the connection when a response body fails after its headers were sent", async () => {
        let response = await fetch(`${server.origin}/stream/fails`);
        let reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
        expect(response.status).toBe(200);
        expect((await reader.read()).value).toBe("partial\n");

        let fail = await fetch(`${server.origin}/stream/fail`);
        expect(fail.status).toBe(204);

        // No error page can follow a 200 that already started: the client sees
        // the body end abnormally rather than hanging, and Vite logs the error.
        await expect(reader.read()).rejects.toThrow();
        await waitFor(async () => server.stderr().includes("Internal server error: stream broke"));
    });

    it("cancels the handler's request signal and response body when the client disconnects", async () => {
        let controller = new AbortController();
        let response = await fetch(`${server.origin}/cancel`, { signal: controller.signal });
        let reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
        expect((await reader.read()).value).toBe("started\n");

        controller.abort();

        let cancellation: unknown;
        await waitFor(async () => {
            cancellation = await (await fetch(`${server.origin}/cancellation`)).json();
            return (
                JSON.stringify(cancellation) ===
                JSON.stringify({ signalAborted: true, bodyCancelled: true })
            );
        });
        expect(cancellation).toEqual({ signalAborted: true, bodyCancelled: true });
    });

    it("leaves files Vite serves itself ahead of the application", async () => {
        let response = await fetch(`${server.origin}/robots.txt`);

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("User-agent: *\nAllow: /\n");
    });

    it("lets the application answer the root even when an index.html exists", async () => {
        let response = await fetch(`${server.origin}/`);

        expect(await response.text()).toBe("fixture home");
    });

    it("reports an application error through Vite's development error page", async () => {
        let response = await fetch(`${server.origin}/throws`);
        let body = await response.text();

        expect(response.status).toBe(500);
        expect(body).toContain("<title>Error</title>");
        expect(body).toContain("fixture handler failed");
        expect(server.stderr()).toContain("Internal server error: fixture handler failed");
    });
});

describe("proposal 0005: fetchServer module updates", () => {
    let fixture: FixtureCopy;
    let server: DevServer;
    let entryPath: string;
    let original: string;

    // Vite's watcher drops a second change to one file within 50ms, so an edit
    // made right after another test's edit is never seen. Each test starts fresh.
    beforeEach(async () => {
        fixture = await copyFixture();
        entryPath = join(fixture.root, ENTRY);
        original = await readFile(entryPath, "utf8");
        server = await startDevServer({ ...fixture, plugin: { entry: ENTRY } });
    });

    afterEach(async () => {
        await server?.close();
        await fixture?.remove();
    });

    let version = async () => (await fetch(`${server.origin}/version`)).text();

    it("serves the current handler after its source changes", async () => {
        expect(await version()).toBe("v1");

        await writeFile(entryPath, original.replace('version: "v1"', 'version: "v2"'));

        await waitFor(async () => (await version()) === "v2");
    });

    it("reports a broken entry through Vite's error path instead of a stale response, then recovers", async () => {
        expect(await version()).toBe("v1");

        await writeFile(entryPath, `${original}\nexport const broken = ;\n`);

        let response: Response | undefined;
        await waitFor(async () => {
            response = await fetch(`${server.origin}/version`);
            return response.status === 500;
        });
        let body = await response!.text();
        expect(body).toContain("<title>Error</title>");
        expect(body).not.toBe("v1");
        expect(server.stderr()).toContain("Internal server error");

        await writeFile(entryPath, original.replace('version: "v1"', 'version: "v3"'));

        await waitFor(async () => (await version()) === "v3");
    });
});

describe("proposal 0005: fetchServer entry", () => {
    let fixture: FixtureCopy;

    beforeAll(async () => {
        fixture = await copyFixture();
    });

    afterAll(async () => {
        await fixture?.remove();
    });

    it("rejects an omitted entry even when the environment has a build input named index", async () => {
        let message = await startupError({
            ...fixture,
            plugin: {},
            ssrInput: { index: ENTRY },
        });

        expect(message).toMatch(/entry/);
    });

    it("rejects an empty entry even when the environment has a single build input", async () => {
        let message = await startupError({
            ...fixture,
            plugin: { entry: "" },
            ssrInput: ENTRY,
        });

        expect(message).toMatch(/entry/);
    });

    it("serves the explicit entry rather than the environment's build input", async () => {
        let server = await startDevServer({
            ...fixture,
            plugin: { entry: ENTRY },
            ssrInput: { index: "server/other.ts" },
        });
        try {
            let response = await fetch(`${server.origin}/receiver`);
            expect(await response.text()).toBe("fixture-handler");
        } finally {
            await server.close();
        }
    });

    it("passes the original URL, including Vite's base, to the handler", async () => {
        let server = await startDevServer({ ...fixture, plugin: { entry: ENTRY }, base: "/app/" });
        try {
            let response = await fetch(`${server.origin}/app/echo?x=1`);
            let echoed: { url: string } = await response.json();
            expect(echoed.url).toBe(`${server.origin}/app/echo?x=1`);
        } finally {
            await server.close();
        }
    });

    it("reports an entry without a default fetch method through Vite's error path", async () => {
        let server = await startDevServer({ ...fixture, plugin: { entry: "server/no-fetch.ts" } });
        try {
            let response = await fetch(`${server.origin}/`);
            expect(response.status).toBe(500);
            expect(await response.text()).toContain("<title>Error</title>");
            expect(server.stderr()).toContain("Internal server error");
            expect(server.stderr()).toMatch(/fetch/);
        } finally {
            await server.close();
        }
    });

    it("reports an entry that cannot be loaded through Vite's error path", async () => {
        let server = await startDevServer({ ...fixture, plugin: { entry: "server/missing.ts" } });
        try {
            let response = await fetch(`${server.origin}/`);
            expect(response.status).toBe(500);
            expect(await response.text()).toContain("<title>Error</title>");
            expect(server.stderr()).toContain("Internal server error");
            expect(server.stderr()).toContain("server/missing.ts");
        } finally {
            await server.close();
        }
    });
});

describe("proposal 0005: fetchServer environment", () => {
    let fixture: FixtureCopy;

    beforeAll(async () => {
        fixture = await copyFixture();
    });

    afterAll(async () => {
        await fixture?.remove();
    });

    it("loads the entry through a named runnable environment", async () => {
        let server = await startDevServer({
            ...fixture,
            plugin: { entry: ENTRY, environment: "app" },
            runnableEnvironments: ["app"],
        });
        try {
            let response = await fetch(`${server.origin}/receiver`);
            expect(await response.text()).toBe("fixture-handler");
        } finally {
            await server.close();
        }
    });

    it("rejects an environment that does not exist", async () => {
        let message = await startupError({
            ...fixture,
            plugin: { entry: ENTRY, environment: "edge" },
        });

        expect(message).toMatch(/"edge"/);
    });

    it("rejects an environment without a module runner instead of taking it over", async () => {
        let message = await startupError({
            ...fixture,
            plugin: { entry: ENTRY, environment: "worker" },
            nonRunnableEnvironments: ["worker"],
        });

        expect(message).toMatch(/"worker"/);
        expect(message).toMatch(/runnable/);
    });
});

describe("proposal 0005: fetchServer configuration", () => {
    it("makes the dev server a custom app unless the application chose an appType", async () => {
        let defaulted = await resolveConfig(
            { configFile: false, logLevel: "silent", plugins: [fetchServer({ entry: ENTRY })] },
            "serve",
        );
        let explicit = await resolveConfig(
            {
                configFile: false,
                logLevel: "silent",
                appType: "spa",
                plugins: [fetchServer({ entry: ENTRY })],
            },
            "serve",
        );

        expect(defaulted.appType).toBe("custom");
        expect(explicit.appType).toBe("spa");
    });
});
