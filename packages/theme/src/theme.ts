import { serializeValue } from "./serialize.ts";
import { parseTokens, ThemeError } from "./tokens.ts";
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

    // `var(--x)` ref → concrete serialized base value (aliases chased to the end).
    let rawByRef = new Map<string, string>();
    let rawByKey = new Map<string, string>();
    for (let token of tokens.values()) {
        rawByRef.set(`var(${token.varName})`, resolveRaw(token, tokens, ctx, rawByKey, []));
    }

    let cssText = buildCssText(declarations, []);
    void cssText; // consumed by the Theme component in Task 7

    return {
        token: buildAccessor(tokens) as TokenTree<T>,
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
