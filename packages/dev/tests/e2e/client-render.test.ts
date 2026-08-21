import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { serveFixture } from "./harness.ts";

const FIXTURE = join(import.meta.dirname, "../fixtures/client-render-app");
const DEV_PORT = 7331;

// `server: false` removes the server. An app that only wants its UI off the
// server keeps the default mode instead: `remix()` never requires the server
// entry to render app UI, so a router that answers JSON and one `remix/ui`
// shell is a client-rendered app with live server routes. This is the shape
// the SPA guide documents as the alternative to SPA mode.
describe("client rendering with a server", () => {
    it("answers data routes as JSON and every document route with one shell", async () => {
        let [home, post, api] = await serveFixture(FIXTURE, DEV_PORT, [
            { path: "/" },
            { path: "/posts/hello-world" },
            { path: "/api/posts" },
        ]);

        // Nothing was rendered on the server: both document routes returned
        // the same empty shell, pointing at the client entry. The DOCTYPE is
        // `createHtmlResponse`'s doing — `renderToString` does not emit one,
        // and a shell without it puts the browser in quirks mode.
        expect(home?.status).toBe(200);
        expect(home?.body).toMatch(/^<!DOCTYPE html><html lang="en">/);
        expect(home?.body).toContain('<div id="app"></div>');
        expect(home?.body).toContain("/app/entry.browser.tsx");
        expect(post?.body).toBe(home?.body);

        // And the server still answers data routes at request time, which is
        // exactly what SPA mode gives up.
        expect(api?.status).toBe(200);
        expect(JSON.parse(api?.body ?? "null")).toEqual([
            { id: "hello-world", title: "Hello world" },
            { id: "second-post", title: "Second post" },
        ]);
    });
});
