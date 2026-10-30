import { describe, expect, it } from "vitest";

import { fromDTCG, toDTCG } from "./dtcg.ts";
import * as s from "./schema.ts";
import { createTheme } from "./theme.ts";
import { ThemeError } from "./tokens.ts";

describe("fromDTCG", () => {
    it("lowers a DTCG document into a theme that emits the expected CSS", () => {
        let init = fromDTCG({
            color: {
                $type: "color",
                white: { $value: "#fff" },
                page: { $value: "{color.white}" },
            },
            space: {
                $type: "dimension",
                sm: { $value: { value: 0.25, unit: "rem" } },
            },
        });

        let theme = createTheme(init);
        expect(theme.cssText).toContain("--color-white: #fff;");
        expect(theme.cssText).toContain("--color-page: var(--color-white);");
        expect(theme.cssText).toContain("--space-sm: 0.25rem;");
    });

    it("uses reference type resolution before an inherited group type", () => {
        let init = fromDTCG({
            control: {
                $type: "dimension",
                height: { $value: "28px" },
                opacity: {
                    $type: "number",
                    disabled: { $value: 0.5 },
                },
                copiedOpacity: { $value: "{control.opacity.disabled}" },
            },
        });

        let theme = createTheme(init);
        expect(theme.cssText).toContain("--control-height: 28px;");
        expect(theme.cssText).toContain("--control-opacity-disabled: 0.5;");
        expect(theme.cssText).toContain(
            "--control-copied-opacity: var(--control-opacity-disabled);",
        );
    });

    it("rejects typography tokens", () => {
        expect(() => fromDTCG({ heading: { $type: "typography", $value: {} } })).toThrow(
            new ThemeError('"heading": typography tokens are not supported in v1'),
        );
    });
});

describe("toDTCG", () => {
    it("reverses an exact custom-property reference", () => {
        let theme = createTheme({
            schema: { color: s.color() },
            tokens: { color: { white: "#fff", page: "var(--color-white)" } },
            modes: {
                dark: { tokens: { color: { page: "var(--color-white)" } } },
            },
        });

        let exported = toDTCG(theme);
        let color = exported.document.color as Record<string, unknown>;
        let page = color.page as Record<string, unknown>;
        let dark = exported.modes.dark as Record<string, unknown>;
        let darkColor = dark.color as Record<string, unknown>;
        let darkPage = darkColor.page as Record<string, unknown>;

        expect(page.$value).toBe("{color.white}");
        expect(darkPage.$value).toBe("{color.white}");
    });

    it("counts a CSS value DTCG cannot represent", () => {
        let theme = createTheme({
            schema: { layout: s.dimension() },
            tokens: { layout: { gutter: "clamp(1rem, 4vw, 2.5rem)" } },
        });

        let exported = toDTCG(theme);
        let layout = exported.document.layout as Record<string, unknown>;
        let gutter = layout.gutter as Record<string, unknown>;
        let extensions = gutter.$extensions as Record<string, unknown>;

        expect(exported.inexpressible).toBe(1);
        expect(extensions["tools.pitlane"]).toMatchObject({
            type: "dimension",
            value: "clamp(1rem, 4vw, 2.5rem)",
        });
    });
});
