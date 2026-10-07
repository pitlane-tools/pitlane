// Starts the production server on a free port and checks, in headless Chromium,
// that the home page hydrates, that the router loads a lazy route in the
// browser, and that nothing logs a console error. Run it after `npm run build`.
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
    let counter = page.locator(".counter");
    assert.equal(await counter.textContent(), "Count: 0");
    await counter.click();
    await counter.filter({ hasText: "Count: 1" }).waitFor({ timeout: 5_000 });

    // A client-side navigation keeps the document, so the marker survives it.
    await page.evaluate(() => Object.assign(window, { sameDocument: true }));
    await page.getByRole("link", { name: "About" }).click();
    await page.locator(".about h1", { hasText: "About" }).waitFor({ timeout: 5_000 });
    assert.equal(new URL(page.url()).pathname, "/about");
    assert.equal(await page.evaluate(() => "sameDocument" in window), true, "the router navigated");

    await page.goto(`${origin}/faq`);
    await page.getByRole("heading", { name: "FAQ" }).waitFor();

    assert.deepEqual(errors, [], "no console errors");
    console.log(
        JSON.stringify({
            hydrated: true,
            counter: "Count: 1",
            clientNavigation: "/about",
            consoleErrors: 0,
        }),
    );
} finally {
    await browser?.close();
    server.kill();
}
