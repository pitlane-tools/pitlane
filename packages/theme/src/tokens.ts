import { TOKEN_TYPES } from "./brands.ts";
import type { TokenType } from "./brands.ts";
import type { DTCGDocument } from "./types.ts";

export class ThemeError extends Error {
    override name = "ThemeError";
}

export interface ParsedToken {
    key: string;
    path: readonly string[];
    varName: string;
    type: TokenType;
    value: unknown;
    aliasOf?: string;
}

const ALIAS_RE = /^\{([^{}]+)\}$/;

export function aliasTarget(value: unknown): string | null {
    if (typeof value !== "string") return null;
    let match = ALIAS_RE.exec(value);
    return match ? match[1] : null;
}

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

export function parseTokens(document: DTCGDocument): Map<string, ParsedToken> {
    let entries = new Map<string, RawEntry>();
    walk(document, [], undefined, entries);

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
        throw new ThemeError(`"${key}" has unknown $type "${String(value)}"`);
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
