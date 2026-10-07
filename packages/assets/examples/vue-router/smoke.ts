// Starts the production server and drives it in headless Chromium: the Vapor
// counter must respond to a click once the page hydrates, client navigation
// must load the lazy about page with its stylesheet, and the console must stay
// free of errors, which is where Vue reports hydration mismatches in production.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { chromium } from "playwright";

let probe = createServer().listen(0);
await once(probe, "listening");
let address = probe.address();
assert.ok(address && typeof address === "object");
let port = address.port;
probe.close();

let server = spawn(process.execPath, ["server.ts"], {
    cwd: import.meta.dirname,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "inherit"],
});
let browser = await chromium.launch();
let errors: string[] = [];

try {
    let [chunk] = await once(server.stdout, "data");
    assert.match(String(chunk), /Listening on/);
    let origin = `http://localhost:${port}`;

    let page = await browser.newPage();
    page.on("console", message => {
        if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));

    await page.goto(`${origin}/`);
    // Vue records the app on its container once `mount()` has hydrated it.
    await page.waitForFunction(() => "__vue_app__" in document.querySelector("#root")!);
    let counter = page.getByRole("button", { name: /Count:/ });
    await counter.click();
    await counter.click();
    assert.equal(await counter.textContent(), "Count: 2", "the Vapor counter updates");

    await page.getByRole("link", { name: "About" }).click();
    await page.getByRole("heading", { name: "About" }).waitFor();
    let accent = await page
        .locator(".stack")
        .evaluate(element => getComputedStyle(element).borderLeftStyle);
    assert.equal(accent, "solid", "client navigation applies the about page's stylesheet");

    await page.goto(`${origin}/faq`);
    await page.waitForFunction(() => "__vue_app__" in document.querySelector("#root")!);
    await page.getByRole("link", { name: "Home" }).click();
    await page.getByRole("button", { name: "Count: 0" }).click();
    await page.getByRole("button", { name: "Count: 1" }).waitFor();

    assert.deepEqual(errors, [], "the console has no errors");
    console.log(JSON.stringify({ origin, hydrated: true, errors }, undefined, 4));
} catch (error) {
    if (errors.length > 0) console.error("Browser console errors:", errors);
    throw error;
} finally {
    await browser.close();
    server.kill();
}
