import type { Handle, RemixElement } from "remix/ui";

import { createElement } from "remix/ui";

import type { AnyToken } from "./brands.ts";
import type { SerializeContext } from "./serialize.ts";
import type { ParsedToken } from "./tokens.ts";
import type { DeepPartialTokens, DTCGDocument, TokenTree } from "./types.ts";

import { serializeValue } from "./serialize.ts";
import { aliasTarget, parseTokens, ThemeError } from "./tokens.ts";

/**
 * Options for {@link createTheme}.
 *
 * @see {@link DeepPartialTokens} for the override shape.
 */
export interface ThemeOptions<T> {
    /**
     * Per-appearance token overrides. Each mode is a partial of the
     * base document that may set `$value` only; its overrides emit
     * inside an `@media (prefers-color-scheme: <mode>)` block, so the
     * OS appearance setting flips the affected variables with no
     * attribute selectors and no JavaScript.
     */
    modes?: {
        /** Overrides applied under `prefers-color-scheme: light`. */
        light?: DeepPartialTokens<T>;
        /** Overrides applied under `prefers-color-scheme: dark`. */
        dark?: DeepPartialTokens<T>;
    };
}

/**
 * Props for the {@link ThemeComponent}. `nonce` sets the `nonce`
 * attribute on the emitted `<style>` element for Content Security
 * Policy setups.
 */
export type ThemeProps = {
    /** CSP nonce forwarded to the `<style>` element's `nonce` attribute. */
    nonce?: string;
};

/**
 * The `<Theme />` component returned by {@link createTheme}. Render it
 * once near the document root (e.g. inside `<head>`). It renders a
 * `<style data-pitlane-theme>` element holding the base `:root`
 * declarations plus one `@media` block per configured mode, streams
 * identically on the server and the client, and escapes the style
 * text so token values cannot break out of the tag.
 *
 * @see {@link ThemeProps} for the `nonce` prop.
 */
export type ThemeComponent = (handle: Handle<ThemeProps>) => () => RemixElement;

function createThemeComponent(cssText: string): ThemeComponent {
    let escaped = cssText.replace(/<\/style/gi, "<\\/style");
    return function Theme(handle) {
        return () =>
            createElement("style", {
                nonce: handle.props.nonce,
                "data-pitlane-theme": "",
                innerHTML: escaped,
            });
    };
}

/**
 * The object returned by {@link createTheme}: the typed token
 * accessor, the `raw` resolver, and the `<Theme />` component.
 */
export interface ThemeResult<T> {
    /**
     * Same-shape accessor over the document: every token leaf is a
     * branded `var(--…)` reference string. Numeric keys index with
     * brackets (`t.color.gray[900]`).
     *
     * @see {@link TokenTree}
     */
    token: TokenTree<T>;
    /**
     * Resolves a token ref to its serialized base-mode value, chasing
     * aliases and composite sub-value references to the end. It always
     * answers for the base mode, even when a dark override exists,
     * since mode resolution happens in CSS rather than in JavaScript.
     * Because refs are plain strings, two themes that mint the same
     * token path produce identical refs and `raw` cannot tell them
     * apart, answering for its own theme.
     *
     * @param ref - A branded token ref from this theme's accessor.
     * @throws ThemeError if `ref` names a variable this theme never
     * minted.
     */
    raw(ref: AnyToken): string;
    /** The `<Theme />` component. @see {@link ThemeComponent} */
    Theme: ThemeComponent;
}

/**
 * Compiles a DTCG design-token document into a typed accessor, a
 * `raw` resolver, and a `<Theme />` component. All validation and
 * serialization happen eagerly here: a malformed document throws
 * {@link ThemeError} rather than emitting broken CSS.
 *
 * Each token becomes a CSS custom property named after its
 * kebab-cased path — `color.gray.900` becomes `--color-gray-900`.
 * Two paths that collide after kebab-casing throw, as do names
 * containing `.`, `{`, or `}`, which the alias syntax reserves.
 *
 * Author the document in TypeScript, not imported JSON: `createTheme`
 * infers a `const` type parameter, so an inline object needs no
 * `as const`, but a JSON import widens its literals and the token
 * brands degrade.
 *
 * @param config - The token document. Groups nest to any depth; a
 * node with a `$value` is a token.
 * @param options - Optional per-mode overrides ({@link ThemeOptions}).
 * @returns The {@link ThemeResult}: `token`, `raw`, and `Theme`.
 * @throws ThemeError on any validation failure (unknown or
 * unresolvable `$type`, reserved characters, variable collision,
 * unknown or wrong-typed alias, alias cycle, invalid value, or a bad
 * mode override).
 *
 * @see {@link DTCGDocument} for the document shape, the accepted
 * `$value` forms, and alias semantics.
 *
 * @example
 * ```ts
 * export let { token: t, raw, Theme } = createTheme(
 *     {
 *         color: {
 *             $type: "color",
 *             white: { $value: "#fff" },
 *             gray: { 900: { $value: "#171717" } },
 *             bg: { $value: "{color.white}" }, // alias → var() indirection
 *         },
 *     },
 *     { modes: { dark: { color: { bg: { $value: "{color.gray.900}" } } } } },
 * );
 *
 * t.color.bg; // "var(--color-bg)"
 * raw(t.color.bg); // "#fff" (base mode, alias chased to the end)
 * ```
 */
export function createTheme<const T extends DTCGDocument>(
    config: T,
    options: ThemeOptions<T> = {},
): ThemeResult<T> {
    let compiled = compile(config, options.modes ?? {});

    // `var(--x)` ref → concrete serialized base value: full-value aliases AND
    // composite sub-value references are chased to the end.
    let rawByRef = new Map<string, string>();
    let rawByKey = new Map<string, string>();
    for (let token of compiled.tokens.values()) {
        rawByRef.set(`var(${token.varName})`, resolveRaw(token, compiled.tokens, rawByKey, []));
    }

    return {
        token: buildAccessor(compiled.tokens) as TokenTree<T>,
        raw(ref) {
            let value = rawByRef.get(ref);
            if (value === undefined) {
                throw new ThemeError(`raw(): "${ref}" names a var this theme never minted`);
            }
            return value;
        },
        Theme: createThemeComponent(compiled.cssText),
    };
}

interface CompiledTheme {
    tokens: Map<string, ParsedToken>;
    cssText: string;
}

function compile(config: DTCGDocument, modes: { light?: unknown; dark?: unknown }): CompiledTheme {
    let tokens = parseTokens(config);
    let ctx: SerializeContext = {
        varRefFor(key, from, expected) {
            let target = tokens.get(key);
            if (!target) {
                throw new ThemeError(`"${from}" references unknown token "${key}"`);
            }
            if (target.type !== expected) {
                throw new ThemeError(
                    `"${from}" references "${key}" of type "${target.type}" where "${expected}" is required`,
                );
            }
            return `var(${target.varName})`;
        },
    };

    // varName → css value; aliases keep their indirection as var() references.
    let declarations = new Map<string, string>();
    for (let token of tokens.values()) {
        declarations.set(
            token.varName,
            token.aliasOf !== undefined
                ? ctx.varRefFor(token.aliasOf, token.key, token.type)
                : serializeValue(token.type, token.value, ctx, token.key),
        );
    }

    let modeBlocks: string[] = [];
    for (let mode of ["light", "dark"] as const) {
        let overrides = modes[mode];
        if (overrides === undefined) continue;
        let modeDeclarations = compileModeOverrides(overrides, tokens, ctx);
        if (modeDeclarations.size === 0) continue;
        let lines = [...modeDeclarations].map(([name, value]) => `        ${name}: ${value};`);
        modeBlocks.push(
            `@media (prefers-color-scheme: ${mode}) {\n    :root {\n${lines.join("\n")}\n    }\n}`,
        );
    }

    return { tokens, cssText: buildCssText(declarations, modeBlocks) };
}

/**
 * Compiles a document to its CSS text alone, bypassing the accessor
 * and the component.
 *
 * @internal
 */
export function compileThemeCss<const T extends DTCGDocument>(
    config: T,
    options: ThemeOptions<T> = {},
): string {
    return compile(config, options.modes ?? {}).cssText;
}

function compileModeOverrides(
    overrides: unknown,
    tokens: Map<string, ParsedToken>,
    ctx: SerializeContext,
): Map<string, string> {
    let out = new Map<string, string>();
    walkMode(overrides, [], tokens, ctx, out);
    return out;
}

function walkMode(
    node: unknown,
    path: readonly string[],
    tokens: Map<string, ParsedToken>,
    ctx: SerializeContext,
    out: Map<string, string>,
): void {
    if (typeof node !== "object" || node === null) {
        throw new ThemeError(`Mode override "${path.join(".")}" is neither a group nor a token`);
    }
    let record = node as Record<string, unknown>;
    if ("$value" in record) {
        let key = path.join(".");
        let keys = Object.keys(record);
        if (keys.length !== 1) {
            throw new ThemeError(`Mode override "${key}" may only set $value`);
        }
        let base = tokens.get(key);
        if (!base) {
            throw new ThemeError(`Mode override "${key}" does not exist in the base document`);
        }
        let alias = aliasTarget(record.$value);
        out.set(
            base.varName,
            alias !== null
                ? ctx.varRefFor(alias, key, base.type)
                : serializeValue(base.type, record.$value, ctx, key),
        );
        return;
    }
    for (let [key, child] of Object.entries(record)) {
        if (key.startsWith("$")) {
            throw new ThemeError(`Mode override "${[...path, key].join(".")}" may only set $value`);
        }
        walkMode(child, [...path, key], tokens, ctx, out);
    }
}

function resolveRaw(
    token: ParsedToken,
    tokens: Map<string, ParsedToken>,
    memo: Map<string, string>,
    chain: string[],
): string {
    let cached = memo.get(token.key);
    if (cached !== undefined) return cached;
    if (chain.includes(token.key)) {
        throw new ThemeError(`Alias cycle: ${[...chain, token.key].join(" → ")}`);
    }
    let value: string;
    if (token.aliasOf !== undefined) {
        let target = tokens.get(token.aliasOf);
        if (!target) {
            throw new ThemeError(`"${token.key}" references unknown token "${token.aliasOf}"`);
        }
        value = resolveRaw(target, tokens, memo, [...chain, token.key]);
    } else {
        // Serialize with a context that inlines fully-resolved base values, so
        // raw() output never depends on the theme's CSS variables being present.
        // Type agreement was already enforced by compile()'s context.
        let rawCtx: SerializeContext = {
            varRefFor(key, from) {
                let target = tokens.get(key);
                if (!target) {
                    throw new ThemeError(`"${from}" references unknown token "${key}"`);
                }
                return resolveRaw(target, tokens, memo, [...chain, token.key]);
            },
        };
        value = serializeValue(token.type, token.value, rawCtx, token.key);
    }
    memo.set(token.key, value);
    return value;
}

function buildAccessor(tokens: Map<string, ParsedToken>): unknown {
    // Null-prototype nodes: a group segment named like an Object.prototype
    // member ("__proto__", "constructor", …) must create an own key, never
    // read or write through the prototype chain.
    let root: Record<string, unknown> = Object.create(null);
    for (let token of tokens.values()) {
        let node = root;
        for (let segment of token.path.slice(0, -1)) {
            node = (node[segment] ??= Object.create(null)) as Record<string, unknown>;
        }
        node[token.path[token.path.length - 1]] = `var(${token.varName})`;
    }
    return root;
}

function buildCssText(declarations: Map<string, string>, modeBlocks: readonly string[]): string {
    let lines = [...declarations].map(([name, value]) => `    ${name}: ${value};`);
    let blocks = [`:root {\n${lines.join("\n")}\n}`, ...modeBlocks];
    return blocks.join("\n\n");
}
