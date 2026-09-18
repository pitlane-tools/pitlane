import { describe, expect, it } from "vitest";

import { readEsm } from "./mdx.ts";

/**
 * The attributes clause is read here rather than through `render()` because
 * Vite loads a `.json` import without one. Only a real host refuses, so a test
 * that renders through Vite passes whether the clause survives or not.
 */
describe("readEsm, on an import with attributes", () => {
    it("carries the clause the host needs to load the module", async () => {
        let { imports } = await readEsm(
            'import data from "./data.json" with { type: "json" };',
            "post.mdx",
        );

        expect(imports).toHaveLength(1);
        expect(imports[0]!.attributes).toEqual({ type: "json" });
    });

    it("leaves an import with no clause without attributes", async () => {
        let { imports } = await readEsm('import { Badge } from "./badge.tsx";', "post.mdx");

        expect(imports[0]!.attributes).toBeUndefined();
    });
});
