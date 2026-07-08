import { describe, expect, it } from "vitest";

import { aliasTarget, kebabSegment, parseTokens, ThemeError } from "./tokens.ts";

describe("aliasTarget", () => {
    it("extracts full-value alias paths", () => {
        expect(aliasTarget("{color.white}")).toBe("color.white");
    });

    it("returns null for non-aliases", () => {
        expect(aliasTarget("#fff")).toBe(null);
        expect(aliasTarget("{a.b} extra")).toBe(null);
        expect(aliasTarget(16)).toBe(null);
    });
});

describe("kebabSegment", () => {
    it("splits camelCase and lowercases", () => {
        expect(kebabSegment("backgroundHover")).toBe("background-hover");
    });

    it("passes numeric segments through", () => {
        expect(kebabSegment("900")).toBe("900");
    });

    it("collapses invalid characters", () => {
        expect(kebabSegment("Brand Blue!")).toBe("brand-blue");
    });

    it("throws when a segment collapses to nothing", () => {
        expect(() => kebabSegment("***")).toThrow(ThemeError);
    });
});

describe("parseTokens", () => {
    it("walks groups and inherits $type", () => {
        let tokens = parseTokens({
            color: { $type: "color", gray: { 900: { $value: "#171717" } } },
        });
        let token = tokens.get("color.gray.900");
        expect(token).toMatchObject({
            key: "color.gray.900",
            path: ["color", "gray", "900"],
            varName: "--color-gray-900",
            type: "color",
            value: "#171717",
        });
    });

    it("prefers a token's own $type over the inherited one", () => {
        let tokens = parseTokens({
            misc: { $type: "color", weight: { $type: "fontWeight", $value: 700 } },
        });
        expect(tokens.get("misc.weight")?.type).toBe("fontWeight");
    });

    it("resolves alias token types from the target", () => {
        let tokens = parseTokens({
            color: { $type: "color", white: { $value: "#fff" } },
            bg: { $value: "{color.white}" },
        });
        let bg = tokens.get("bg");
        expect(bg?.type).toBe("color");
        expect(bg?.aliasOf).toBe("color.white");
    });

    it("prefers the alias target's type over a group-inherited $type (DTCG order)", () => {
        let tokens = parseTokens({
            motion: { $type: "duration", fast: { $value: "150ms" } },
            color: { $type: "color", pulse: { $value: "{motion.fast}" } },
        });
        expect(tokens.get("color.pulse")?.type).toBe("duration");
    });

    it("resolves alias chains", () => {
        let tokens = parseTokens({
            a: { $type: "color", $value: "#fff" },
            b: { $value: "{a}" },
            c: { $value: "{b}" },
        });
        expect(tokens.get("c")?.type).toBe("color");
    });

    it("throws on a token with no resolvable $type", () => {
        expect(() => parseTokens({ orphan: { $value: "#fff" } })).toThrow(/orphan/);
    });

    it("throws on unknown $type", () => {
        expect(() => parseTokens({ x: { $type: "sparkles" as never, $value: 1 } })).toThrow(/sparkles/);
    });

    it("rejects typography tokens with a dedicated message", () => {
        expect(() =>
            parseTokens({ heading: { $type: "typography" as never, $value: {} } }),
        ).toThrow(/typography tokens are not supported/);
    });

    it("throws on an alias to a nonexistent token", () => {
        expect(() => parseTokens({ bg: { $value: "{color.white}" } })).toThrow(/color\.white/);
    });

    it("throws on alias type cycles, reporting the chain", () => {
        expect(() => parseTokens({ a: { $value: "{b}" }, b: { $value: "{a}" } })).toThrow(
            /a → b → a/,
        );
    });

    it("throws on var-name collisions, reporting both paths", () => {
        let error = getError(() =>
            parseTokens({
                color: { $type: "color", "brand blue": { $value: "#00f" }, brandBlue: { $value: "#00e" } },
            }),
        );
        expect(error).toBeInstanceOf(ThemeError);
        expect(error.message).toContain("color.brand blue");
        expect(error.message).toContain("color.brandBlue");
    });

    it("ignores $description, $extensions, and $deprecated", () => {
        let tokens = parseTokens({
            color: {
                $type: "color",
                $description: "palette",
                $extensions: { "com.example": true },
                white: { $value: "#fff", $description: "pure", $deprecated: true },
            },
        });
        expect(tokens.get("color.white")?.value).toBe("#fff");
    });

    it("throws on non-object, non-token members", () => {
        expect(() => parseTokens({ color: { white: "#fff" } } as never)).toThrow(/color\.white/);
    });
});

function getError(fn: () => unknown): Error {
    try {
        fn();
    } catch (error) {
        return error as Error;
    }
    throw new Error("expected function to throw");
}
