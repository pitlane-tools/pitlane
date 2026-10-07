// Starts the production server on a free port and loads it in headless
// Chromium: the counter must respond once React hydrates, client navigation
// must load the lazy post, and the browser must report no errors.
import type { ChildProcess } from "node:child_process";

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { chromium } from "playwright";

async function freePort(): Promise<number> {
    let probe = createServer().listen(0);
    await once(probe, "listening");
    let address = probe.address();
    assert.ok(address && typeof address === "object");
    probe.close();
    return address.port;
}

async function startServer(port: number): Promise<ChildProcess> {
    let child = spawn(process.execPath, ["server.ts"], {
        cwd: import.meta.dirname,
        env: { ...process.env, PORT: String(port) },
        stdio: ["ignore", "pipe", "inherit"],
    });
    let output = "";
    for await (let chunk of child.stdout!) {
        output += String(chunk);
        if (output.includes("Listening")) return child;
    }
    throw new Error(`server.ts exited before listening (code ${child.exitCode})`);
}

let port = await freePort();
let server = await startServer(port);
let browser = await chromium.launch();
let errors: string[] = [];

try {
    let page = await browser.newPage();
    page.on("console", message => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", error => errors.push(`page: ${error.message}`));
    page.on("requestfailed", request => errors.push(`request failed: ${request.url()}`));
    page.on("response", response => {
        if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`);
    });

    let origin = `http://localhost:${port}`;
    // Module scripts and the lazy route chunk have loaded once the network is idle.
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Increment" }).click();
    await page.getByText("Count: 1").waitFor({ timeout: 5_000 });

    await page.getByRole("link", { name: "Blog post" }).click();
    await page.getByRole("heading", { name: "Hello, World" }).waitFor({ timeout: 5_000 });
    assert.equal(new URL(page.url()).pathname, "/blog/hello-world");

    await page.goto(`${origin}/about`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "About" }).waitFor({ timeout: 5_000 });

    assert.deepEqual(errors, [], "the browser reported no errors");
    console.log(JSON.stringify({ origin, hydrated: true, errors }, undefined, 4));
} finally {
    await browser.close();
    server.kill();
}
