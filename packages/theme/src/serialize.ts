import type { TokenType } from "./brands.ts";

import { aliasTarget, ThemeError } from "./tokens.ts";

export interface SerializeContext {
    varRefFor(key: string, from: string, expected: TokenType): string;
}

const FONT_WEIGHT_KEYWORDS: Record<string, number> = {
    thin: 100,
    hairline: 100,
    "extra-light": 200,
    "ultra-light": 200,
    light: 300,
    normal: 400,
    regular: 400,
    book: 400,
    medium: 500,
    "semi-bold": 600,
    "demi-bold": 600,
    bold: 700,
    "extra-bold": 800,
    "ultra-bold": 800,
    black: 900,
    heavy: 900,
    "extra-black": 950,
    "ultra-black": 950,
};

const COLOR_FUNCTIONS: Record<string, { fn: string; percents?: readonly number[] }> = {
    hsl: { fn: "hsl", percents: [1, 2] },
    hwb: { fn: "hwb", percents: [1, 2] },
    lab: { fn: "lab" },
    lch: { fn: "lch" },
    oklab: { fn: "oklab" },
    oklch: { fn: "oklch" },
};

const COLOR_SPACES = new Set([
    "srgb",
    "srgb-linear",
    "display-p3",
    "a98-rgb",
    "prophoto-rgb",
    "rec2020",
    "xyz-d65",
    "xyz-d50",
]);

const STROKE_KEYWORDS = new Set([
    "solid",
    "dashed",
    "dotted",
    "double",
    "groove",
    "ridge",
    "outset",
    "inset",
]);

export function serializeValue(
    type: TokenType,
    value: unknown,
    ctx: SerializeContext,
    key: string,
): string {
    switch (type) {
        case "color":
            return serializeColor(value, key);
        case "dimension":
            return serializeMeasure(value, ["px", "rem"], key);
        case "duration":
            return serializeMeasure(value, ["ms", "s"], key);
        case "fontFamily":
            return serializeFontFamily(value, key);
        case "fontWeight":
            return serializeFontWeight(value, key);
        case "number":
            return serializeNumber(value, key);
        case "cubicBezier":
            return serializeCubicBezier(value, key);
        case "shadow":
            return serializeShadow(value, ctx, key);
        case "border":
            return serializeBorder(value, ctx, key);
        case "transition":
            return serializeTransition(value, ctx, key);
        case "gradient":
            return serializeGradient(value, ctx, key);
        case "strokeStyle":
            return serializeStrokeStyle(value, key);
    }
}

function field(type: TokenType, value: unknown, ctx: SerializeContext, key: string): string {
    let alias = aliasTarget(value);
    if (alias !== null) return ctx.varRefFor(alias, key, type);
    return serializeValue(type, value, ctx, key);
}

function invalid(key: string, type: string, value: unknown): ThemeError {
    return new ThemeError(`"${key}" has an invalid ${type} value: ${JSON.stringify(value)}`);
}

function serializeColor(value: unknown, key: string): string {
    if (typeof value === "string") return value;
    if (typeof value !== "object" || value === null) throw invalid(key, "color", value);
    let { colorSpace, components, alpha, hex } = value as {
        colorSpace?: unknown;
        components?: unknown;
        alpha?: unknown;
        hex?: unknown;
    };
    if (typeof hex === "string") return hex;
    if (typeof colorSpace !== "string" || !Array.isArray(components)) {
        throw invalid(key, "color", value);
    }
    let parts = components.map(component =>
        component === "none" ? "none" : serializeNumber(component, key),
    );
    let alphaPart = alpha === undefined ? "" : ` / ${serializeNumber(alpha, key)}`;
    let fn = COLOR_FUNCTIONS[colorSpace];
    if (fn) {
        let printed = parts.map((part, index) =>
            fn.percents?.includes(index) && part !== "none" ? `${part}%` : part,
        );
        return `${fn.fn}(${printed.join(" ")}${alphaPart})`;
    }
    if (COLOR_SPACES.has(colorSpace)) {
        return `color(${colorSpace} ${parts.join(" ")}${alphaPart})`;
    }
    throw new ThemeError(`"${key}" has unknown colorSpace "${colorSpace}"`);
}

function serializeMeasure(value: unknown, units: readonly string[], key: string): string {
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null) {
        let { value: amount, unit } = value as { value?: unknown; unit?: unknown };
        if (typeof amount === "number" && typeof unit === "string" && units.includes(unit)) {
            return `${amount}${unit}`;
        }
    }
    throw invalid(key, `dimension/duration (${units.join("|")})`, value);
}

function serializeFontFamily(value: unknown, key: string): string {
    let names = Array.isArray(value) ? value : [value];
    if (names.length === 0) throw invalid(key, "fontFamily", value);
    return names
        .map(name => {
            if (typeof name !== "string") throw invalid(key, "fontFamily", value);
            return /^[a-zA-Z][a-zA-Z-]*$/.test(name) ? name : `"${name.replaceAll('"', '\\"')}"`;
        })
        .join(", ");
}

function serializeFontWeight(value: unknown, key: string): string {
    if (typeof value === "number") {
        if (value >= 1 && value <= 1000) return String(value);
        throw invalid(key, "fontWeight", value);
    }
    if (typeof value === "string") {
        let mapped = FONT_WEIGHT_KEYWORDS[value];
        if (mapped !== undefined) return String(mapped);
        throw new ThemeError(`"${key}" has unknown fontWeight keyword "${value}"`);
    }
    throw invalid(key, "fontWeight", value);
}

function serializeNumber(value: unknown, key: string): string {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw invalid(key, "number", value);
    }
    return String(value);
}

function serializeCubicBezier(value: unknown, key: string): string {
    if (!Array.isArray(value) || value.length !== 4) throw invalid(key, "cubicBezier", value);
    return `cubic-bezier(${value.map(part => serializeNumber(part, key)).join(", ")})`;
}

function serializeShadow(value: unknown, ctx: SerializeContext, key: string): string {
    let shadows = Array.isArray(value) ? value : [value];
    return shadows
        .map(shadow => {
            if (typeof shadow !== "object" || shadow === null) throw invalid(key, "shadow", value);
            let { color, offsetX, offsetY, blur, spread, inset } = shadow as Record<
                string,
                unknown
            >;
            let parts = [
                field("dimension", offsetX, ctx, key),
                field("dimension", offsetY, ctx, key),
                blur === undefined ? "0" : field("dimension", blur, ctx, key),
                spread === undefined ? "0" : field("dimension", spread, ctx, key),
                field("color", color, ctx, key),
            ];
            return `${inset === true ? "inset " : ""}${parts.join(" ")}`;
        })
        .join(", ");
}

function serializeBorder(value: unknown, ctx: SerializeContext, key: string): string {
    if (typeof value !== "object" || value === null) throw invalid(key, "border", value);
    let { color, width, style } = value as Record<string, unknown>;
    return `${field("dimension", width, ctx, key)} ${field("strokeStyle", style, ctx, key)} ${field("color", color, ctx, key)}`;
}

function serializeTransition(value: unknown, ctx: SerializeContext, key: string): string {
    if (typeof value !== "object" || value === null) throw invalid(key, "transition", value);
    let { duration, timingFunction, delay } = value as Record<string, unknown>;
    let delayPart = delay === undefined ? "0s" : field("duration", delay, ctx, key);
    return `${field("duration", duration, ctx, key)} ${field("cubicBezier", timingFunction, ctx, key)} ${delayPart}`;
}

function serializeGradient(value: unknown, ctx: SerializeContext, key: string): string {
    if (!Array.isArray(value)) throw invalid(key, "gradient", value);
    return value
        .map(stop => {
            if (typeof stop !== "object" || stop === null) throw invalid(key, "gradient", value);
            let { color, position } = stop as Record<string, unknown>;
            if (typeof position !== "number")
                throw invalid(key, "gradient stop position", position);
            // Trim float noise from the 0–1 → % conversion (0.07 → "7%").
            return `${field("color", color, ctx, key)} ${Number((position * 100).toFixed(4))}%`;
        })
        .join(", ");
}

function serializeStrokeStyle(value: unknown, key: string): string {
    if (typeof value === "string") {
        if (STROKE_KEYWORDS.has(value)) return value;
        throw new ThemeError(`"${key}" has unknown strokeStyle keyword "${value}"`);
    }
    if (typeof value === "object" && value !== null) return "dashed";
    throw invalid(key, "strokeStyle", value);
}
