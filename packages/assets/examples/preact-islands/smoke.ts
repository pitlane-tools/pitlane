// Starts the production server on a free port and checks, in headless Chromium,
// that the home page's islands hydrate and both pages run without console
// errors. Run it after `npm run build`.
import type { Browser } from "playwright";

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { chromium } from "playwright";

let probe = createServer().listen(0);
await once(probe, "listening");
let address = probe.address();
assert.ok(address && typeof address === "object");
let { port } = address;
probe.close();

let server = spawn(process.execPath, ["server.ts"], {
    cwd: import.meta.dirname,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "inherit"],
});
let browser: Browser | undefined;
try {
    let [listening] = await Promise.race([
        once(server.stdout, "data"),
        once(server, "exit").then(([code]) => {
            throw new Error(`server.ts exited with ${code} before listening`);
        }),
    ]);
    assert.match(String(listening), /Listening/);

    browser = await chromium.launch();
    let page = await browser.newPage();
    let errors: string[] = [];
    page.on("console", message => {
        if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));
    page.on("requestfailed", request => errors.push(`${request.url()} failed`));

    let origin = `http://localhost:${port}`;
    await page.goto(`${origin}/`);
    await page.locator("preact-island[hydrated]").nth(1).waitFor({ timeout: 10_000 });

    let counter = page.locator(".counter");
    assert.equal(await counter.locator("output").textContent(), "Count: 2");
    await counter.getByRole("button").click();
    // Preact renders state updates asynchronously.
    await counter.locator("output", { hasText: "Count: 3" }).waitFor({ timeout: 5_000 });

    let disclosure = page.getByRole("button", { name: /island chunks/ });
    await disclosure.click();
    await page.getByText(/emits it as a browser entry/).waitFor({ timeout: 5_000 });

    await page.goto(`${origin}/about`);
    await page.getByRole("heading", { name: "About" }).waitFor();
    assert.equal(await page.locator("preact-island").count(), 0);

    assert.deepEqual(errors, [], "no console errors");
    console.log(JSON.stringify({ hydrated: true, counter: "Count: 3", consoleErrors: 0 }));
} finally {
    await browser?.close();
    server.kill();
}
