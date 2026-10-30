import { describe, expect, it } from "vitest";

import type { SerializeContext } from "./serialize.ts";

import { serializeValue } from "./serialize.ts";
import { ThemeError } from "./tokens.ts";

let ctx: SerializeContext = {
    varRefFor(key, from) {
        if (key === "color.white") return "var(--color-white)";
        throw new ThemeError(`"${from}" references unknown token "${key}"`);
    },
};

function run(type: Parameters<typeof serializeValue>[0], value: unknown): string {
    return serializeValue(type, value, ctx, "test.token");
}

describe("color", () => {
    it("passes strings through", () => {
        expect(run("color", "#fff")).toBe("#fff");
        expect(run("color", "rgb(0 0 0)")).toBe("rgb(0 0 0)");
    });

    it("prefers hex on structured values", () => {
        expect(run("color", { colorSpace: "srgb", components: [1, 1, 1], hex: "#ffffff" })).toBe(
            "#ffffff",
        );
    });

    it("serializes function color spaces", () => {
        expect(run("color", { colorSpace: "hsl", components: [120, 50, 60] })).toBe(
            "hsl(120 50% 60%)",
        );
        expect(run("color", { colorSpace: "hwb", components: [30, 10, 20] })).toBe(
            "hwb(30 10% 20%)",
        );
        expect(run("color", { colorSpace: "oklch", components: [0.7, 0.1, 250] })).toBe(
            "oklch(0.7 0.1 250)",
        );
        expect(run("color", { colorSpace: "lab", components: [50, 20, -30] })).toBe(
            "lab(50 20 -30)",
        );
    });

    it("serializes color() spaces with alpha and none", () => {
        expect(
            run("color", { colorSpace: "display-p3", components: [1, 0, "none"], alpha: 0.5 }),
        ).toBe("color(display-p3 1 0 none / 0.5)");
        expect(run("color", { colorSpace: "srgb", components: [1, 0, 0] })).toBe(
            "color(srgb 1 0 0)",
        );
    });

    it("throws on unknown color spaces", () => {
        expect(() => run("color", { colorSpace: "cmyk", components: [0, 0, 0, 0] })).toThrow(
            /cmyk/,
        );
    });
});

describe("dimension and duration", () => {
    it("accepts legacy strings and structured objects", () => {
        expect(run("dimension", "16px")).toBe("16px");
        expect(run("dimension", { value: 1.5, unit: "rem" })).toBe("1.5rem");
        expect(run("duration", "200ms")).toBe("200ms");
        expect(run("duration", { value: 2, unit: "s" })).toBe("2s");
    });

    it("throws on unknown units", () => {
        expect(() => run("dimension", { value: 4, unit: "em" })).toThrow(/test\.token/);
        expect(() => run("duration", { value: 4, unit: "min" })).toThrow(/test\.token/);
    });
});

describe("fontFamily", () => {
    it("quotes names that need it and joins arrays", () => {
        expect(run("fontFamily", "monospace")).toBe("monospace");
        expect(run("fontFamily", ["Helvetica Neue", "sans-serif"])).toBe(
            '"Helvetica Neue", sans-serif',
        );
    });

    it("throws on an empty fontFamily array", () => {
        expect(() => run("fontFamily", [])).toThrow(/test\.token/);
    });
});

describe("fontWeight", () => {
    it("passes numbers and maps keywords", () => {
        expect(run("fontWeight", 400)).toBe("400");
        expect(run("fontWeight", "semi-bold")).toBe("600");
        expect(run("fontWeight", "extra-black")).toBe("950");
    });

    it("throws on out-of-range numbers and unknown keywords", () => {
        expect(() => run("fontWeight", 0)).toThrow(/test\.token/);
        expect(() => run("fontWeight", "chonky")).toThrow(/chonky/);
    });
});

describe("number and cubicBezier", () => {
    it("serializes", () => {
        expect(run("number", 0.5)).toBe("0.5");
        expect(run("cubicBezier", [0.4, 0, 0.2, 1])).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
    });

    it("passes a computed unitless value through", () => {
        expect(run("number", "calc(1.25 / 0.875)")).toBe("calc(1.25 / 0.875)");
    });

    it("throws on malformed values", () => {
        expect(() => run("number", true)).toThrow(/test\.token/);
        expect(() => run("cubicBezier", [1, 2, 3])).toThrow(/test\.token/);
        expect(() => run("cubicBezier", ["a", "b", "c", "d"])).toThrow(/test\.token/);
    });
});

describe("shadow", () => {
    it("serializes a single shadow with defaults", () => {
        expect(run("shadow", { color: "#000", offsetX: "0px", offsetY: "1px" })).toBe(
            "0px 1px 0 0 #000",
        );
    });

    it("serializes inset, arrays, and converted sub-value references", () => {
        expect(
            run("shadow", [
                {
                    color: "var(--color-white)",
                    offsetX: "0px",
                    offsetY: "1px",
                    blur: "3px",
                    spread: "0px",
                    inset: true,
                },
                { color: "#000", offsetX: { value: 0, unit: "px" }, offsetY: "2px" },
            ]),
        ).toBe("inset 0px 1px 3px 0px var(--color-white), 0px 2px 0 0 #000");
    });
});

describe("border, transition, gradient, strokeStyle", () => {
    it("serializes border", () => {
        expect(run("border", { color: "var(--color-white)", width: "1px", style: "solid" })).toBe(
            "1px solid var(--color-white)",
        );
    });

    it("serializes transition with default delay", () => {
        expect(run("transition", { duration: "200ms", timingFunction: [0.4, 0, 0.2, 1] })).toBe(
            "200ms cubic-bezier(0.4, 0, 0.2, 1) 0s",
        );
        expect(
            run("transition", { duration: "200ms", timingFunction: [0, 0, 1, 1], delay: "50ms" }),
        ).toBe("200ms cubic-bezier(0, 0, 1, 1) 50ms");
    });

    it("serializes gradient stop lists", () => {
        expect(
            run("gradient", [
                { color: "#fff", position: 0 },
                { color: "var(--color-white)", position: 1 },
            ]),
        ).toBe("#fff 0%, var(--color-white) 100%");
    });

    it("emits gradient stop percentages without float artifacts", () => {
        expect(
            run("gradient", [
                { color: "#fff", position: 0.07 },
                { color: "#000", position: 0.29 },
            ]),
        ).toBe("#fff 7%, #000 29%");
    });

    it("serializes strokeStyle keywords and the object fallback", () => {
        expect(run("strokeStyle", "dotted")).toBe("dotted");
        expect(run("strokeStyle", { dashArray: ["2px"], lineCap: "round" })).toBe("dashed");
        expect(() => run("strokeStyle", "wavy")).toThrow(/test\.token/);
    });
});

describe("CSS text passthrough", () => {
    it("takes a composite as the shorthand it compiles to", () => {
        expect(run("shadow", "inset 0 1px 2px rgb(0 0 0 / 0.2)")).toBe(
            "inset 0 1px 2px rgb(0 0 0 / 0.2)",
        );
        expect(run("shadow", "0 1px 2px var(--color-line)")).toBe("0 1px 2px var(--color-line)");
        expect(run("border", "1px solid #ddd")).toBe("1px solid #ddd");
        expect(run("transition", "150ms ease-in-out 0s")).toBe("150ms ease-in-out 0s");
        expect(run("gradient", "linear-gradient(to right, #fff, #000)")).toBe(
            "linear-gradient(to right, #fff, #000)",
        );
        expect(run("cubicBezier", "ease-in-out")).toBe("ease-in-out");
    });

    it("takes a font stack as one string, and quotes an array", () => {
        expect(run("fontFamily", '"Inter", ui-sans-serif, system-ui')).toBe(
            '"Inter", ui-sans-serif, system-ui',
        );
        expect(run("fontFamily", ["Inter var", "sans-serif"])).toBe('"Inter var", sans-serif');
    });
});
