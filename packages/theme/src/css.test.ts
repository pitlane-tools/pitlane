import { createElement } from "remix/ui";
import { renderToString } from "remix/ui/server";
import { describe, expect, it } from "vitest";

import { css } from "./css.ts";
import * as s from "./schema.ts";
import { createTheme } from "./theme.ts";

let { token: t } = createTheme({
    schema: { color: s.color(), space: s.dimension() },
    tokens: { color: { white: "#fff" }, space: { sm: "8px", md: "16px" } },
});

describe("css", () => {
    it("renders token refs, tuple joins, and nesting through remix/ui css()", async () => {
        let html = await renderToString(
            createElement("div", {
                mix: css({
                    color: t.color.white,
                    padding: [t.space.sm, t.space.md],
                    margin: 0,
                    "&:hover": { color: t.color.white },
                }),
            }),
        );
        expect(html).toContain("color: var(--color-white)");
        expect(html).toContain("padding: var(--space-sm) var(--space-md)");
        expect(html).toContain("margin: 0");
        expect(html).toContain(":hover");
        // The mixin generated a class and attached it to the element
        expect(html).toMatch(/<div class="/);
    });

    it("space-joins arrays on custom properties (documented: comma lists need a template string)", async () => {
        let html = await renderToString(
            createElement("div", {
                mix: css({ "--stack": [t.space.sm, t.space.md] }),
            }),
        );
        expect(html).toContain("--stack: var(--space-sm) var(--space-md)");
    });
});
