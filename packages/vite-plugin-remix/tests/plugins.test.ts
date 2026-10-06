import { describe, expect, it } from "vite-plus/test";

import { remix } from "../src/index.ts";

describe("remix()", () => {
    it("refuses prerendering in SPA mode", () => {
        // Prerendering renders through the server entry, which SPA mode does
        // not build. Failing at config time beats failing mid-build.
        expect(() => remix({ server: false, prerender: true })).toThrow(/not supported/);
        expect(() => remix({ server: false, prerender: ["/"] })).toThrow(/not supported/);
        expect(() => remix({ server: false })).not.toThrow();
    });
});
