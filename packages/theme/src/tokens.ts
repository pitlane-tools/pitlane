import type { TokenType } from "./brands.ts";
import type { SchemaNode, TokenSchema } from "./schema.ts";
import type { Tokens } from "./types.ts";

import { childSchema, selfSchema, TAG } from "./schema.ts";

/**
 * The error {@link createTheme} throws for every structural failure:
 * one problem, one sentence.
 *
 * | Failure | Message shape |
 * | --- | --- |
 * | No schema entry | `"space.md" has no schema entry` |
 * | Unknown reference | `"color.bg" references unknown token "color.nope"` |
 * | Reference type mismatch | `"color.bg" references "space.md" of type "dimension" where "color" is required` |
 * | Reference to an untyped token | `"color.bg" references untyped token "animate.spin"` |
 * | Reference cycle | `Reference cycle: color.a → color.b → color.a` |
 * | Variable collision | `Tokens "a.b" and "a-b" both produce the CSS variable --a-b` |
 * | Reserved characters | `Token or group name "a.b" contains characters reserved by references (".", "{", "}")` |
 * | Empty identifier | `Token path segment "!!" produces an empty CSS identifier` |
 * | Unknown mode token | `Mode "dark" overrides unknown token "color.nope"` |
 *
 * Bad token *values* raise `ValidationError` from `remix/data-schema`
 * instead, because there may be several and each carries its own path.
 *
 * @see {@link createTheme}
 */
export class ThemeError extends Error {
    override name = "ThemeError";
}

/**
 * A token whose schema named one of the twelve DTCG types. Only these
 * entries reach the per-type serializers.
 *
 * @internal
 */
export interface TypedEntry {
    kind: "typed";
    key: string;
    path: readonly string[];
    varName: string;
    type: TokenType;
    value: unknown;
    aliasOf?: string;
}

/**
 * A dimension token whose accessor leaf multiplies. Declared with
 * `s.scale()`.
 *
 * @internal
 */
export interface ScaleEntry {
    kind: "scale";
    key: string;
    path: readonly string[];
    varName: string;
    value: unknown;
}

/**
 * A token with no type, declared with `s.any()`. Its value is already
 * a string by the time validation is done with it.
 *
 * @internal
 */
export interface UntypedEntry {
    kind: "untyped";
    key: string;
    path: readonly string[];
    varName: string;
    value: string;
}

/**
 * One token in the intermediate representation, tagged by kind. The
 * tag is what keeps the twelve-type serializer switch exhaustive: an
 * optional `type` would force an `undefined` branch through every
 * consumer of it.
 *
 * @internal
 */
export type Entry = ScaleEntry | TypedEntry | UntypedEntry;

const REFERENCE_RE = /^\{([^{}]+)\}$/;
const VAR_RE = /^var\((--[a-z0-9-]+)\)$/;

/**
 * Extracts the target key from a `"{path.to.token}"` reference, or
 * `null` when the value is not a reference.
 *
 * @internal
 */
export function referenceTarget(value: unknown): string | null {
    if (typeof value !== "string") return null;
    let match = REFERENCE_RE.exec(value);
    return match ? match[1]! : null;
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

/**
 * Walks the token tree and the schema tree together, in document
 * order, into one list of tagged entries. Rejects a token with no
 * schema entry, a reserved character in a name, and two tokens whose
 * paths collide after kebab-casing.
 *
 * @internal
 */
export function collectTokens(tokens: Tokens, schema: SchemaNode): Entry[] {
    let entries: Entry[] = [];
    let varNames = new Map<string, string>();
    walk(tokens, schema, undefined, [], entries, varNames);
    linkVarReferences(entries);
    return entries;
}

/**
 * A reference written as an accessor property access arrives as the string
 * `var(--color-white)` rather than `{color.white}`, because that is what the
 * accessor leaf is. The two spellings are meant to be interchangeable, so a
 * second pass turns an in-theme `var()` value into a reference like any other.
 * That makes it type-checked, resolvable by `raw`, and visible to `select`.
 *
 * A `var()` naming something this theme does not declare is left alone: it may
 * be a custom property the application defines elsewhere.
 */
function linkVarReferences(entries: Entry[]): void {
    let byVarName = new Map(entries.map(entry => [entry.varName, entry]));
    for (let entry of entries) {
        if (entry.kind !== "typed" || entry.aliasOf !== undefined) continue;
        if (typeof entry.value !== "string") continue;
        let match = VAR_RE.exec(entry.value);
        if (match === null) continue;
        let target = byVarName.get(match[1]!);
        if (target !== undefined) entry.aliasOf = target.key;
    }
}

function walk(
    node: Tokens,
    schema: unknown,
    inherited: TokenSchema | undefined,
    path: readonly string[],
    out: Entry[],
    varNames: Map<string, string>,
): void {
    for (let [key, value] of Object.entries(node)) {
        let childPath = [...path, key];
        let childKey = childPath.join(".");
        if (/[.{}]/.test(key)) {
            throw new ThemeError(
                `Token or group name "${childKey}" contains characters reserved by references (".", "{", "}")`,
            );
        }
        let child = childSchema(schema, key);
        let own = selfSchema(child) ?? inherited;

        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            walk(value as Tokens, child, own, childPath, out, varNames);
            continue;
        }

        if (own === undefined) throw new ThemeError(`"${childKey}" has no schema entry`);

        let varName = `--${childPath.map(kebabSegment).join("-")}`;
        let existing = varNames.get(varName);
        if (existing !== undefined) {
            throw new ThemeError(
                `Tokens "${existing}" and "${childKey}" both produce the CSS variable ${varName}`,
            );
        }
        varNames.set(varName, childKey);

        let common = { key: childKey, path: childPath, varName };
        let tag = own[TAG];
        if (tag === "any") {
            out.push({ kind: "untyped", ...common, value: String(value) });
        } else if (tag === "scale") {
            out.push({ kind: "scale", ...common, value });
        } else {
            let target = referenceTarget(value);
            out.push({
                kind: "typed",
                ...common,
                type: tag,
                value,
                ...(target === null ? {} : { aliasOf: target }),
            });
        }
    }
}
