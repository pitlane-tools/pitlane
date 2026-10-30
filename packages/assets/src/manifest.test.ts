import { describe, expect, it } from "vitest";

import manifest from "./manifest.ts";

describe("proposal 0005: @pitlane/assets/manifest", () => {
    it("declares that no build integration supplied a manifest", () => {
        expect(manifest).toEqual({ mode: "unavailable" });
    });
});
