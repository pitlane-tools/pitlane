import { describe, expectTypeOf, it } from "vitest";

import { tva } from "./tva.ts";
import type { TVAProps } from "./tva.ts";

let button = tva({
    variants: {
        intent: { primary: {}, danger: {} },
        block: { true: {}, false: {} },
    },
});

describe("TVAProps", () => {
    it("maps variant keys to unions and booleans", () => {
        expectTypeOf<TVAProps<typeof button>>().toEqualTypeOf<{
            intent?: "primary" | "danger";
            block?: boolean;
        }>();
    });

    it("rejects unknown variant values", () => {
        // @ts-expect-error — "ghost" is not a declared intent
        button({ intent: "ghost" });
    });
});
