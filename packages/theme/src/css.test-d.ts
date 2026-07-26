import type { MixInput } from "remix/ui";

import { describe, it } from "vitest";

import { css } from "./css.ts";
import { combine, tva } from "./tva.ts";

// MixinDescriptor is invariant in its node type: these assignments compile
// only because css()/tva()/combine() are node-generic and bind the element
// type from the assignment (or `mix` prop) position. Regression coverage for
// the erased-genericity bug the demo app surfaced.
describe("mix-position assignability", () => {
    it("binds css() to the target element's node type", () => {
        let html: MixInput<HTMLHtmlElement> = css({ backgroundColor: "transparent" });
        let div: MixInput<HTMLDivElement> = css({ margin: 0 });
        let image: MixInput<HTMLImageElement> = css({});
        void html;
        void div;
        void image;
    });

    it("binds tva and combine results per callsite", () => {
        let button = tva({ variants: { intent: { primary: {} } } });
        let rounded = tva({ variants: { pill: { true: {} } } });

        let plain: MixInput<HTMLButtonElement> = button({ intent: "primary" });
        let composed: MixInput<HTMLButtonElement> = combine(button, rounded)({ pill: true });
        void plain;
        void composed;
    });
});
