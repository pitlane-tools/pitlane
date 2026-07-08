import { serializeValue } from "./serialize.ts";
import { aliasTarget, parseTokens, ThemeError } from "./tokens.ts";
import type { AnyToken } from "./brands.ts";
import type { SerializeContext } from "./serialize.ts";
import type { ParsedToken } from "./tokens.ts";
import type { DeepPartialTokens, DTCGDocument, TokenTree } from "./types.ts";

export interface ThemeOptions<T> {
    modes?: {
        light?: DeepPartialTokens<T>;
        dark?: DeepPartialTokens<T>;
    };
}

// Placeholder until Task 7 wires the real component type.
export type ThemeComponent = () => unknown;

export interface ThemeResult<T> {
    token: TokenTree<T>;
    raw(ref: AnyToken): string;
    Theme: ThemeComponent;
}

export function createTheme<const T extends DTCGDocument>(
    config: T,
    options: ThemeOptions<T> = {},
): ThemeResult<T> {
    let compiled = compile(config, options.modes ?? {});

    // `var(--x)` ref → concrete serialized base value (aliases chased to the end).
    let rawByRef = new Map<string, string>();
    let rawByKey = new Map<string, string>();
    for (let token of compiled.tokens.values()) {
        rawByRef.set(
            `var(${token.varName})`,
            resolveRaw(token, compiled.tokens, compiled.ctx, rawByKey, []),
        );
    }

    return {
        token: buildAccessor(compiled.tokens) as TokenTree<T>,
        raw(ref) {
            let value = rawByRef.get(ref);
            if (value === undefined) {
                throw new ThemeError(`raw(): "${ref}" was not minted by this theme`);
            }
            return value;
        },
        Theme: () => null,
    };
}

interface CompiledTheme {
    tokens: Map<string, ParsedToken>;
    ctx: SerializeContext;
    cssText: string;
}

function compile(config: DTCGDocument, modes: { light?: unknown; dark?: unknown }): CompiledTheme {
    let tokens = parseTokens(config);
    let ctx: SerializeContext = {
        varRefFor(key, from) {
            let target = tokens.get(key);
            if (!target) {
                throw new ThemeError(`"${from}" references unknown token "${key}"`);
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
                ? ctx.varRefFor(token.aliasOf, token.key)
                : serializeValue(token.type, token.value, ctx, token.key),
        );
    }

    let modeBlocks: string[] = [];
    for (let mode of ["light", "dark"] as const) {
        let overrides = modes[mode];
        if (overrides === undefined) continue;
        let modeDeclarations = compileModeOverrides(overrides, tokens, ctx);
        let lines = [...modeDeclarations].map(([name, value]) => `        ${name}: ${value};`);
        modeBlocks.push(
            `@media (prefers-color-scheme: ${mode}) {\n    :root {\n${lines.join("\n")}\n    }\n}`,
        );
    }

    return { tokens, ctx, cssText: buildCssText(declarations, modeBlocks) };
}

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
                ? ctx.varRefFor(alias, key)
                : serializeValue(base.type, record.$value, ctx, key),
        );
        return;
    }
    for (let [key, child] of Object.entries(record)) {
        if (key.startsWith("$")) {
            throw new ThemeError(
                `Mode override "${[...path, key].join(".")}" may only set $value`,
            );
        }
        walkMode(child, [...path, key], tokens, ctx, out);
    }
}

function resolveRaw(
    token: ParsedToken,
    tokens: Map<string, ParsedToken>,
    ctx: SerializeContext,
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
        value = resolveRaw(target, tokens, ctx, memo, [...chain, token.key]);
    } else {
        value = serializeValue(token.type, token.value, ctx, token.key);
    }
    memo.set(token.key, value);
    return value;
}

function buildAccessor(tokens: Map<string, ParsedToken>): unknown {
    let root: Record<string, unknown> = {};
    for (let token of tokens.values()) {
        let node = root;
        for (let segment of token.path.slice(0, -1)) {
            node = (node[segment] ??= {}) as Record<string, unknown>;
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
