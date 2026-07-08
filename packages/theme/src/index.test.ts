import { describe, expect, it } from "vitest";

import { VERSION } from "./index.ts";

describe("package scaffold", () => {
    it("resolves the module", () => {
        expect(VERSION).toBe("0.1.0");
    });
});
