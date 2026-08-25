import type { Handle, RemixElement } from "remix/ui";

import { parse } from "remix/data-schema";
import { createElement } from "remix/ui";

import type { AnyToken, TokenType, UntypedToken } from "./brands.ts";
import type { SchemaNode } from "./schema.ts";
import type { SerializeContext } from "./serialize.ts";
import type { Entry } from "./tokens.ts";
import type {
    Merged,
    ResolvedInit,
    ScaleFn,
    ThemeInit,
    ThemeMode,
    Tokens,
    TokenTree,
} from "./types.ts";

import { isTokenSchema } from "./schema.ts";
import { serializeValue } from "./serialize.ts";
import { collectTokens, kebabSegment, referenceTarget, ThemeError } from "./tokens.ts";
import { composeSchema } from "./validate.ts";

/**
 * Props for the {@link ThemeComponent}. `nonce` sets the `nonce`
 * attribute on the emitted `<style>` element for Content Security
 * Policy setups.
 */
export type ThemeProps = {
    nonce?: string;
};

/**
 * The `<Theme />` component {@link createTheme} returns. Render it
 * once near the document root to install the custom properties.
 *
 * It is an ordinary component with one extra property, `$theme`,
 * holding the init it was compiled from, so a published theme can be
 * handed straight back to {@link createTheme}.
 */
export interface ThemeComponent<T> {
    (handle: Handle<ThemeProps>): () => RemixElement;
    readonly $theme: T;
}

/**
 * The object {@link createTheme} returns: the typed token accessor,
 * the `raw` resolver, the `<Theme />` component, and the two
 * derivation methods.
 */
export interface ThemeResult<T> {
    /**
     * The compiled CSS text `<Theme />` installs. Exposed for tests
     * and for a build step that emits it as an asset.
     *
     * @internal
     */
    readonly cssText: string;
    /**
     * A typed mirror of the token tree whose leaves are branded
     * `var()` reference strings. A `s.scale()` leaf is callable.
     */
    readonly token: TokenTree<T>;
    /**
     * Resolves a token reference to its concrete base value, following
     * references to the end.
     *
     * @param ref - A token reference minted by this theme
     * @returns The serialized base value
     * @throws ThemeError when the reference was not minted here
     */
    raw(ref: AnyToken | UntypedToken): string;
    /** The component that installs the custom properties. */
    readonly Theme: ThemeComponent<T>;
    /**
     * Deep-merges a patch onto this theme and returns a new one. A
     * leaf replaces wholesale; every other node recurses.
     *
     * The callback form receives this theme's accessor, so a patch can
     * reference what it extends.
     *
     * @param patch - The tokens and schema to merge, or a callback returning them
     * @returns A new theme
     */
    extend<const schema extends object, const tokens extends object>(
        patch:
            | { schema?: schema; tokens: tokens; modes?: Record<string, ThemeMode<tokens>> }
            | ((base: TokenTree<T>) => {
                  schema?: schema;
                  tokens: tokens;
                  modes?: Record<string, ThemeMode<tokens>>;
              }),
    ): ThemeResult<Merged<T, { schema: schema; tokens: tokens }>>;
    /**
     * Replaces this theme with a projection of it. The callback
     * receives this theme's accessor; every value in the projection is
     * a reference into it, and the new path decides the new custom
     * property name, so a projection may also reshape and rename.
     *
     * @param projection - A callback returning the schema and tokens to keep
     * @returns A new theme
     */
    select<const P extends ThemeInit>(projection: (base: TokenTree<T>) => P): ThemeResult<P>;
}

const REF_RE = /^var\((--[a-z0-9-]+)\)$/;

/**
 * Compiles a theme from a schema tree and the token tree it describes.
 *
 * Values are the CSS they become: a color is any CSS color, a
 * dimension is any CSS length, and a composite is the shorthand text.
 * The schema names each token's type, which is what the accessor's
 * compile-time brands are read from and what `css()` enforces.
 *
 * A token whose value is exactly `"{a.b.c}"` is a reference, and keeps
 * its `var()` indirection in the emitted CSS so a mode override
 * cascades through it.
 *
 * All validation and serialization happen eagerly: a malformed theme
 * throws at module load rather than emitting broken CSS. Bad values
 * raise `ValidationError` from `remix/data-schema`, carrying one issue
 * per bad token with its path. Structural problems raise
 * {@link ThemeError}.
 *
 * @param init - The schema, tokens, and modes, or a `<Theme />` to re-derive from
 * @returns The {@link ThemeResult}
 * @throws ThemeError on a structural failure
 * @throws ValidationError on one or more invalid values
 *
 * @see {@link ThemeInit} for the accepted shape.
 *
 * @example
 * ```ts
 * import { createTheme } from "@pitlane/theme";
 * import * as s from "@pitlane/theme/schema";
 *
 * export let { token: t, raw, Theme } = createTheme({
 *     schema: { color: s.color(), spacing: s.scale() },
 *     tokens: {
 *         color: { white: "#fff", page: "{color.white}" },
 *         spacing: "0.25rem",
 *     },
 * });
 *
 * t.color.page; // "var(--color-page)"
 * raw(t.color.page); // "#fff"
 * t.spacing(4); // "calc(var(--spacing) * 4)"
 * ```
 */
export function createTheme<const schema extends object, const tokens extends object>(init: {
    schema: schema;
    tokens: tokens;
    modes?: Record<string, ThemeMode<tokens>>;
}): ThemeResult<{ schema: schema; tokens: tokens }>;
export function createTheme<T>(theme: ThemeComponent<T>): ThemeResult<T>;
export function createTheme(
    input: ThemeComponent<unknown> | ThemeInit,
): ThemeResult<{ schema: object; tokens: object }> {
    let init = (typeof input === "function" ? input.$theme : input) as ResolvedInit;
    return compile(init);
}

function compile<T>(init: ResolvedInit): ThemeResult<T> {
    // One pass over the whole tree, so every bad value is reported at once.
    parse(composeSchema(init.tokens, init.schema), init.tokens, { abortEarly: false });

    let entries = collectTokens(init.tokens, init.schema as unknown as SchemaNode);
    let byKey = new Map(entries.map(entry => [entry.key, entry]));
    let byVarName = new Map(entries.map(entry => [entry.varName, entry]));
    let ctx = referenceContext(byKey);

    let declarations = entries.map(entry => [entry.varName, declare(entry, ctx)] as const);
    let cssText = buildCssText(declarations, modeBlocks(init.modes, byKey, ctx));

    return {
        cssText,
        token: buildAccessor(entries) as TokenTree<T>,
        Theme: createThemeComponent(cssText, init) as ThemeComponent<T>,
        raw(ref) {
            return resolveRaw(ref, byVarName, byKey, []);
        },
        extend(patch) {
            let accessor = buildAccessor(entries) as never;
            let next = (typeof patch === "function" ? patch(accessor) : patch) as ResolvedInit;
            return compile({
                schema: mergeDeep(init.schema, next.schema ?? {}) as ResolvedInit["schema"],
                tokens: mergeDeep(init.tokens, next.tokens) as Tokens,
                modes: { ...init.modes, ...next.modes },
            });
        },
        select(projection) {
            let next = projection(buildAccessor(entries) as never) as ResolvedInit;
            let projected = reroot(next.tokens, byVarName) as Tokens;
            assertNoDroppedReferences(projected, byVarName);
            return compile({
                schema: next.schema,
                tokens: projected,
                modes: next.modes,
            });
        },
    } as ThemeResult<T>;
}

function referenceContext(byKey: Map<string, Entry>): SerializeContext {
    return {
        varRefFor(key, from, expected) {
            let target = byKey.get(key);
            if (target === undefined) {
                throw new ThemeError(`"${from}" references unknown token "${key}"`);
            }
            if (target.kind === "untyped") {
                throw new ThemeError(`"${from}" references untyped token "${key}"`);
            }
            let type = target.kind === "scale" ? "dimension" : target.type;
            if (type !== expected) {
                throw new ThemeError(
                    `"${from}" references "${key}" of type "${type}" where "${expected}" is required`,
                );
            }
            return `var(${target.varName})`;
        },
    };
}

function declare(entry: Entry, ctx: SerializeContext): string {
    if (entry.kind === "untyped") return entry.value;
    if (entry.kind === "scale") return serializeValue("dimension", entry.value, ctx, entry.key);
    if (entry.aliasOf !== undefined) return ctx.varRefFor(entry.aliasOf, entry.key, entry.type);
    return serializeValue(entry.type, entry.value, ctx, entry.key);
}

function modeBlocks(
    modes: Record<string, ThemeMode<Tokens>> | undefined,
    byKey: Map<string, Entry>,
    ctx: SerializeContext,
): string[] {
    if (modes === undefined) return [];
    let selectorBlocks: string[] = [];
    let mediaBlocks: string[] = [];

    for (let [name, mode] of Object.entries(modes)) {
        let overrides: Array<readonly [string, string]> = [];
        walkMode(mode.tokens, [], name, byKey, ctx, overrides);
        if (overrides.length === 0) continue;

        if (mode.selector !== undefined) {
            let lines = overrides.map(([varName, value]) => `    ${varName}: ${value};`);
            selectorBlocks.push(`${mode.selector} {\n${lines.join("\n")}\n}`);
        }
        let media = mode.media ?? `(prefers-color-scheme: ${name})`;
        let lines = overrides.map(([varName, value]) => `        ${varName}: ${value};`);
        mediaBlocks.push(`@media ${media} {\n    :root {\n${lines.join("\n")}\n    }\n}`);
    }

    // The selector block comes first only for readability. An attribute
    // selector is (0,2,0) against (0,1,0) for `:root` inside a media query, so
    // specificity is what makes an explicit choice beat the OS preference.
    return [...selectorBlocks, ...mediaBlocks];
}

function walkMode(
    node: unknown,
    path: readonly string[],
    mode: string,
    byKey: Map<string, Entry>,
    ctx: SerializeContext,
    out: Array<readonly [string, string]>,
): void {
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
        throw new ThemeError(`Mode "${mode}" override at "${path.join(".")}" is not a group`);
    }
    for (let [key, value] of Object.entries(node)) {
        let childPath = [...path, key];
        let childKey = childPath.join(".");
        let entry = byKey.get(childKey);

        if (entry === undefined) {
            if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                walkMode(value, childPath, mode, byKey, ctx, out);
                continue;
            }
            throw new ThemeError(`Mode "${mode}" overrides unknown token "${childKey}"`);
        }

        if (entry.kind === "untyped") {
            out.push([entry.varName, String(value)]);
            continue;
        }
        let type = entry.kind === "scale" ? ("dimension" as TokenType) : entry.type;
        let target = referenceTarget(value);
        out.push([
            entry.varName,
            target === null
                ? serializeValue(type, value, ctx, childKey)
                : ctx.varRefFor(target, childKey, type),
        ]);
    }
}

function resolveRaw(
    ref: string,
    byVarName: Map<string, Entry>,
    byKey: Map<string, Entry>,
    chain: string[],
): string {
    let match = REF_RE.exec(ref);
    let entry = match === null ? undefined : byVarName.get(match[1]!);
    if (entry === undefined) {
        throw new ThemeError(`"${ref}" was not minted by this theme`);
    }
    if (chain.includes(entry.key)) {
        throw new ThemeError(`Reference cycle: ${[...chain, entry.key].join(" → ")}`);
    }
    if (entry.kind === "typed" && entry.aliasOf !== undefined) {
        let target = byKey.get(entry.aliasOf);
        if (target === undefined) {
            throw new ThemeError(`"${entry.key}" references unknown token "${entry.aliasOf}"`);
        }
        return resolveRaw(`var(${target.varName})`, byVarName, byKey, [...chain, entry.key]);
    }
    if (entry.kind === "untyped") return entry.value;

    // Resolve composite sub-values to concrete text too, so `raw` never returns
    // a value containing a var() indirection.
    let ctx: SerializeContext = {
        varRefFor: (key, from, expected) => {
            let target = byKey.get(key);
            if (target === undefined) {
                throw new ThemeError(`"${from}" references unknown token "${key}"`);
            }
            void expected;
            return resolveRaw(`var(${target.varName})`, byVarName, byKey, [...chain, entry.key]);
        },
    };
    let type = entry.kind === "scale" ? ("dimension" as TokenType) : entry.type;
    return serializeValue(type, entry.value, ctx, entry.key);
}

/**
 * A projected value may itself be a `var()` reference to a token the projection
 * left behind, which the cascade would resolve to nothing. The reference is
 * detectable because its variable belonged to the theme being projected from.
 */
function assertNoDroppedReferences(tokens: Tokens, sourceByVarName: Map<string, Entry>): void {
    let kept = new Set<string>();

    let walkValues = (node: unknown, path: readonly string[]) => {
        if (typeof node === "object" && node !== null && !Array.isArray(node)) {
            for (let [key, value] of Object.entries(node)) walkValues(value, [...path, key]);
            return;
        }
        if (typeof node !== "string") return;
        let match = REF_RE.exec(node);
        if (match === null) return;
        let source = sourceByVarName.get(match[1]!);
        if (source !== undefined && !kept.has(source.varName)) {
            throw new ThemeError(
                `"${path.join(".")}" references "${source.key}", which the projection dropped`,
            );
        }
    };

    // Two passes: the first records which variables the projection still
    // declares, the second checks every value against that set.
    let record = (node: unknown, path: readonly string[]) => {
        if (typeof node === "object" && node !== null && !Array.isArray(node)) {
            for (let [key, value] of Object.entries(node)) record(value, [...path, key]);
            return;
        }
        kept.add(`--${path.map(kebabSegment).join("-")}`);
    };
    record(tokens, []);
    walkValues(tokens, []);
}

function buildAccessor(entries: readonly Entry[]): unknown {
    let root = Object.create(null) as Record<string, unknown>;
    for (let entry of entries) {
        let node = root;
        for (let segment of entry.path.slice(0, -1)) {
            let next = node[segment];
            if (next === undefined) {
                next = Object.create(null) as Record<string, unknown>;
                node[segment] = next;
            }
            node = next as Record<string, unknown>;
        }
        let ref = `var(${entry.varName})`;
        node[entry.path.at(-1)!] = entry.kind === "scale" ? scaleLeaf(ref) : ref;
    }
    return root;
}

function scaleLeaf(ref: string): ScaleFn {
    let fn = (steps: number) => `calc(${ref} * ${steps})`;
    return Object.assign(fn, { token: ref }) as unknown as ScaleFn;
}

function buildCssText(
    declarations: ReadonlyArray<readonly [string, string]>,
    blocks: readonly string[],
): string {
    let lines = declarations.map(([name, value]) => `    ${name}: ${value};`);
    // `light-dark()` resolves against `color-scheme`, and an undeclared
    // `color-scheme` behaves as light, so a theme using the function would
    // silently keep its light values on a dark system. Declaring it here is
    // what makes the function work; an author who wants something narrower
    // declares their own and wins on source order.
    if (declarations.some(([, value]) => value.includes("light-dark("))) {
        lines.unshift("    color-scheme: light dark;");
    }
    return [`:root {\n${lines.join("\n")}\n}`, ...blocks].join("\n\n");
}

function createThemeComponent<T>(cssText: string, init: T): ThemeComponent<T> {
    // Escape once at build time, not per render.
    let escaped = cssText.replaceAll("</style", "<\\/style");
    let component = (handle: Handle<ThemeProps>) => () =>
        createElement("style", {
            nonce: handle.props.nonce,
            "data-pitlane-theme": "",
            innerHTML: escaped,
        });
    return Object.assign(component, { $theme: init }) as ThemeComponent<T>;
}

function mergeDeep(a: unknown, b: unknown): unknown {
    if (!isPlainRecord(a) || !isPlainRecord(b)) return b;
    let out: Record<string, unknown> = { ...a };
    for (let [key, value] of Object.entries(b)) {
        out[key] = mergeDeep(out[key], value);
    }
    return out;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        !isTokenSchema(value)
    );
}

/**
 * A projection holds accessor references, so each one resolves back to
 * the value its token holds. A scale leaf is projected through its
 * `.token`, which is an ordinary reference by the time it arrives.
 */
function reroot(node: unknown, byVarName: Map<string, Entry>): unknown {
    if (typeof node === "object" && node !== null && !Array.isArray(node)) {
        let out: Record<string, unknown> = {};
        for (let [key, value] of Object.entries(node)) out[key] = reroot(value, byVarName);
        return out;
    }
    if (typeof node !== "string") return node;
    let match = REF_RE.exec(node);
    if (match === null) return node;
    let source = byVarName.get(match[1]!);
    if (source === undefined) {
        throw new ThemeError(`"${node}" was not minted by the theme being selected from`);
    }
    return source.value;
}
