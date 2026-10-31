import { describe, expectTypeOf, it } from "vitest";

import type { TVAProps } from "./tva.ts";

import { tva } from "./tva.ts";

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

import { combine } from "./tva.ts";

describe("combine props", () => {
    it("accepts the union of variant props and rejects unknown values", () => {
        let sizing = tva({ variants: { size: { sm: {}, lg: {} } } });
        let toned = tva({ variants: { tone: { loud: {}, quiet: {} } } });
        let both = combine(sizing, toned);
        both({ size: "lg", tone: "quiet" });
        both();
        // @ts-expect-error — "xl" is not a declared size
        both({ size: "xl" });
    });
});
