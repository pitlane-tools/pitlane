import { describe, expect, it } from "vite-plus/test";

import manifest from "./manifest.ts";

describe("proposal 0005: @pitlane/assets/manifest", () => {
    it("declares that no build integration supplied a manifest", () => {
        expect(manifest).toEqual({ mode: "unavailable" });
    });
});
