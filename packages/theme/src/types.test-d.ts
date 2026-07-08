import { describe, expectTypeOf, it } from "vitest";

import type { ColorToken, DimensionToken, DurationToken, ShadowToken } from "./brands.ts";
import type { DeepPartialTokens, TokenTree } from "./types.ts";

const config = {
    color: {
        $type: "color",
        white: { $value: "#fff" },
        gray: { 50: { $value: "#fafafa" }, 900: { $value: "#171717" } },
        bg: { $value: "{color.white}" },
    },
    space: {
        $type: "dimension",
        md: { $value: { value: 16, unit: "px" } },
    },
    shadow: {
        card: {
            $type: "shadow",
            $value: {
                color: "{color.gray.900}",
                offsetX: "0px",
                offsetY: "1px",
                blur: "3px",
                spread: "0px",
            },
        },
    },
    accent: { $type: "color", $value: "#f0f" },
} as const;

type Tree = TokenTree<typeof config>;

describe("TokenTree", () => {
    it("brands leaves by group-inherited $type", () => {
        expectTypeOf<Tree["color"]["white"]>().toEqualTypeOf<ColorToken>();
        expectTypeOf<Tree["color"]["gray"][900]>().toEqualTypeOf<ColorToken>();
        expectTypeOf<Tree["space"]["md"]>().toEqualTypeOf<DimensionToken>();
    });

    it("brands leaves by own $type", () => {
        expectTypeOf<Tree["shadow"]["card"]>().toEqualTypeOf<ShadowToken>();
        expectTypeOf<Tree["accent"]>().toEqualTypeOf<ColorToken>();
    });

    it("brands alias leaves by the target's resolved type", () => {
        expectTypeOf<Tree["color"]["bg"]>().toEqualTypeOf<ColorToken>();
    });

    it("keeps brands nominal", () => {
        expectTypeOf<Tree["color"]["white"]>().not.toEqualTypeOf<DimensionToken>();
        expectTypeOf<ColorToken>().toMatchTypeOf<string>();
        // A plain string is not a ColorToken
        expectTypeOf<string>().not.toMatchTypeOf<ColorToken>();
    });
});

describe("DeepPartialTokens", () => {
    it("accepts a partial override of $value only", () => {
        expectTypeOf<{
            color?: { bg?: { $value: unknown } };
        }>().toMatchTypeOf<DeepPartialTokens<typeof config>>();
    });

    it("rejects unknown paths", () => {
        expectTypeOf<{ nope: { $value: string } }>().not.toMatchTypeOf<
            DeepPartialTokens<typeof config>
        >();
    });
});

describe("typography", () => {
    it("brands typography leaves as never (unsupported in v1)", () => {
        type Typo = TokenTree<{ heading: { $type: "typography"; $value: object } }>;
        expectTypeOf<Typo["heading"]>().toBeNever();
    });
});

describe("TokenTree DTCG resolution precedence", () => {
    it("resolves aliases across numeric key segments", () => {
        type Config = {
            color: {
                $type: "color";
                gray: { 900: { $value: "#171717" } };
            };
            bg2: { $value: "{color.gray.900}" };
        };
        expectTypeOf<TokenTree<Config>["bg2"]>().toEqualTypeOf<ColorToken>();
    });

    it("inherits a root-level document $type", () => {
        expectTypeOf<
            TokenTree<{ $type: "color"; white: { $value: "#fff" } }>["white"]
        >().toEqualTypeOf<ColorToken>();
    });

    it("prefers the alias target's type over group inheritance (DTCG precedence)", () => {
        type Config = {
            motion: { $type: "duration"; fast: { $value: "150ms" } };
            color: { $type: "color"; pulse: { $value: "{motion.fast}" } };
        };
        expectTypeOf<TokenTree<Config>["color"]["pulse"]>().toEqualTypeOf<DurationToken>();
    });
});
