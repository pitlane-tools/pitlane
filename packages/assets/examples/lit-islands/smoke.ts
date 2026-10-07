// Starts the production server and drives it in headless Chromium: both
// islands must hydrate from their server-rendered shadow roots, the counter
// must respond to a click, and the console must stay free of errors.
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
    // A hydrating LitElement adopts the shadow root the parser built from
    // <template shadowrootmode>. One that re-renders from scratch calls
    // attachShadow instead, so any call here means hydration did not happen.
    await page.addInitScript(() => {
        let calls = 0;
        let attachShadow = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (init) {
            calls++;
            return attachShadow.call(this, init);
        };
        Object.defineProperty(window, "attachShadowCalls", { get: () => calls });
    });

    await page.goto(`${origin}/`);
    await page.evaluate(() =>
        Promise.all([
            customElements.whenDefined("lit-counter"),
            customElements.whenDefined("lit-greeting"),
        ]),
    );

    // Playwright's CSS locators pierce open shadow roots.
    let counter = page.locator("lit-counter button");
    assert.equal(await counter.innerText(), "Count: 2", "the server rendered the initial count");
    await counter.click();
    await counter.click();
    await page.locator("lit-counter button", { hasText: "Count: 4" }).waitFor();

    await page.locator("lit-greeting input").fill("Pitlane");
    await page.locator("lit-greeting p", { hasText: "Hello, Pitlane!" }).waitFor();

    let attachShadowCalls = await page.evaluate(() => Reflect.get(window, "attachShadowCalls"));
    assert.equal(attachShadowCalls, 0, "both islands hydrated their declarative shadow roots");

    await page.getByRole("link", { name: "About" }).click();
    await page.getByRole("heading", { name: "About" }).waitFor();
    assert.equal(
        await page.locator("script[type=module]").count(),
        0,
        "the about page loads no script",
    );

    assert.deepEqual(errors, [], "the console has no errors");
    console.log(
        JSON.stringify({ origin, hydrated: true, attachShadowCalls, errors }, undefined, 4),
    );
} finally {
    await browser.close();
    server.kill();
}
