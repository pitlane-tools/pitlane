import type { TokenType } from "./brands.ts";
import type { DTCGDocument } from "./types.ts";

import { TOKEN_TYPES } from "./brands.ts";

/**
 * The error {@link createTheme} throws for every validation and
 * serialization failure. Validation is eager, so a bad document never
 * emits CSS. Every message names the offending token path.
 *
 * | Condition | Message shape |
 * | --- | --- |
 * | Unknown `$type` | `"color.brand" has unknown $type "sparkles"` |
 * | Unresolvable `$type` | `"color.brand" has no resolvable $type` |
 * | Typography token | `"heading": typography tokens are not supported in v1` |
 * | Reserved character in a name | `Token or group name "a.b" contains characters reserved by DTCG references (".", "{", "}")` |
 * | Empty CSS identifier | `Token path segment "!" produces an empty CSS identifier` |
 * | Malformed node | `"color.bg" is neither a group nor a token` |
 * | Variable-name collision | `Tokens "a" and "b" both produce the CSS variable --x` |
 * | Alias to a missing token | `"color.bg" references unknown token "color.white"` |
 * | Alias to a wrong-typed token | `"x" references "space.sm" of type "dimension" where "color" is required` |
 * | Alias cycle | `Alias cycle: a → b → a` |
 * | Invalid value for a declared type | `"x" has an invalid color value: …` — also `unknown colorSpace`, `unknown fontWeight keyword`, and `unknown strokeStyle keyword`; an empty `fontFamily` array counts |
 * | Bad mode override | `Mode override "x" does not exist in the base document`, `Mode override "x" may only set $value`, or (via a cross-type alias) the wrong-typed-alias message |
 * | Unminted `raw()` ref | `raw(): "var(--x)" names a var this theme never minted` |
 */
export class ThemeError extends Error {
    override name = "ThemeError";
}

/**
 * A parsed token: its dotted key, path segments, CSS variable name,
 * resolved type, raw value, and alias target if any.
 *
 * @internal
 */
export interface ParsedToken {
    key: string;
    path: readonly string[];
    varName: string;
    type: TokenType;
    value: unknown;
    aliasOf?: string;
}

const ALIAS_RE = /^\{([^{}]+)\}$/;

/**
 * Extracts the target key from a `"{path.to.token}"` alias string, or
 * `null` when the value is not an alias reference.
 *
 * @internal
 */
export function aliasTarget(value: unknown): string | null {
    if (typeof value !== "string") return null;
    let match = ALIAS_RE.exec(value);
    return match ? match[1] : null;
}

/**
 * Kebab-cases one path segment for a CSS variable name. Throws when
 * the segment reduces to an empty identifier.
 *
 * @internal
 */
export function kebabSegment(segment: string): string {
    let kebab = segment
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!kebab) {
        throw new ThemeError(`Token path segment "${segment}" produces an empty CSS identifier`);
    }
    return kebab;
}

interface RawEntry {
    key: string;
    path: readonly string[];
    ownType: TokenType | undefined;
    inheritedType: TokenType | undefined;
    value: unknown;
}

/**
 * Walks a document, resolves every token's type and CSS variable
 * name, and returns the parsed tokens keyed by dotted path.
 *
 * @internal
 */
export function parseTokens(document: DTCGDocument): Map<string, ParsedToken> {
    let entries = new Map<string, RawEntry>();
    walk(document, [], validateType(document.$type, "$root"), entries);

    let tokens = new Map<string, ParsedToken>();
    let varNames = new Map<string, string>();

    for (let entry of entries.values()) {
        let type = resolveType(entry.key, entries, []);
        let varName = `--${entry.path.map(kebabSegment).join("-")}`;
        let existing = varNames.get(varName);
        if (existing !== undefined) {
            throw new ThemeError(
                `Tokens "${existing}" and "${entry.key}" both produce the CSS variable ${varName}`,
            );
        }
        varNames.set(varName, entry.key);
        let alias = aliasTarget(entry.value);
        tokens.set(entry.key, {
            key: entry.key,
            path: entry.path,
            varName,
            type,
            value: entry.value,
            ...(alias === null ? {} : { aliasOf: alias }),
        });
    }

    return tokens;
}

function walk(
    node: Record<string, unknown>,
    path: readonly string[],
    inherited: TokenType | undefined,
    out: Map<string, RawEntry>,
): void {
    for (let [key, child] of Object.entries(node)) {
        if (key.startsWith("$")) continue;
        let childPath = [...path, key];
        let childKey = childPath.join(".");
        if (/[.{}]/.test(key)) {
            throw new ThemeError(
                `Token or group name "${childKey}" contains characters reserved by DTCG references (".", "{", "}")`,
            );
        }
        if (typeof child !== "object" || child === null || Array.isArray(child)) {
            throw new ThemeError(`"${childKey}" is neither a group nor a token`);
        }
        let record = child as Record<string, unknown>;
        let ownType = validateType(record.$type, childKey);
        if ("$value" in record) {
            out.set(childKey, {
                key: childKey,
                path: childPath,
                ownType,
                inheritedType: inherited,
                value: record.$value,
            });
        } else {
            walk(record, childPath, ownType ?? inherited, out);
        }
    }
}

function validateType(value: unknown, key: string): TokenType | undefined {
    if (value === undefined) return undefined;
    if (value === "typography") {
        throw new ThemeError(`"${key}": typography tokens are not supported in v1`);
    }
    if (!(TOKEN_TYPES as readonly string[]).includes(value as string)) {
        throw new ThemeError(`"${key}" has unknown $type "${String(value as string)}"`);
    }
    return value as TokenType;
}

function resolveType(key: string, entries: Map<string, RawEntry>, chain: string[]): TokenType {
    if (chain.includes(key)) {
        throw new ThemeError(`Alias cycle: ${[...chain, key].join(" → ")}`);
    }
    let entry = entries.get(key);
    if (!entry) {
        throw new ThemeError(
            `"${chain[chain.length - 1] ?? key}" references unknown token "${key}"`,
        );
    }
    if (entry.ownType) return entry.ownType;
    let alias = aliasTarget(entry.value);
    // DTCG order: a reference token takes the referenced token's resolved
    // type BEFORE any group-inherited $type.
    if (alias !== null) return resolveType(alias, entries, [...chain, key]);
    if (entry.inheritedType) return entry.inheritedType;
    throw new ThemeError(`"${key}" has no resolvable $type`);
}
