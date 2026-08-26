import type { TokenType } from "./brands.ts";
import type { SchemaNode, SchemaTag, TokenSchema } from "./schema.ts";
import type { ThemeComponent, ThemeResult } from "./theme.ts";
import type { Entry } from "./tokens.ts";
import type { ThemeInit, Tokens } from "./types.ts";

import { TOKEN_TYPES } from "./brands.ts";
import * as s from "./schema.ts";
import { serializeValue } from "./serialize.ts";
import { collectTokens, kebabSegment, referenceTarget, ThemeError } from "./tokens.ts";

const DTCG_ALIAS_RE = /^\{([^{}]+)\}$/;

/** The token a DTCG `{a.b.c}` alias names, or `null`. */
function dtcgAlias(value: unknown): string | null {
    if (typeof value !== "string") return null;
    let match = DTCG_ALIAS_RE.exec(value);
    return match ? match[1]! : null;
}

/**
 * Rewrites every DTCG alias in a value to its `var()` reference, including the
 * ones inside a composite's sub-values. The authoring format has one reference
 * form, so braces must not survive past this module.
 */
function convertAliases(
    value: unknown,
    key: string,
    varNameFor: (target: string) => string | undefined,
): unknown {
    let alias = dtcgAlias(value);
    if (alias !== null) {
        let varName = varNameFor(alias);
        if (varName === undefined) {
            throw new ThemeError(`"${key}" references unknown token "${alias}"`);
        }
        return `var(${varName})`;
    }
    if (Array.isArray(value)) return value.map(item => convertAliases(item, key, varNameFor));
    if (typeof value === "object" && value !== null) {
        let out: Record<string, unknown> = {};
        for (let [field, item] of Object.entries(value)) {
            out[field] = convertAliases(item, key, varNameFor);
        }
        return out;
    }
    return value;
}

/**
 * A JSON-compatible W3C Design Tokens Community Group document.
 *
 * The DTCG specification permits arbitrary extension keys, so this
 * deliberately remains open rather than attempting to model every
 * standardized and vendor extension.
 */
export type DTCGDocument = Record<string, unknown>;

/**
 * The runtime-shaped init {@link fromDTCG} derives from a DTCG document.
 *
 * Its `schema` and `tokens` use the broad {@link ThemeInit} member types: a
 * JSON document cannot produce the literal information required to brand a
 * token accessor. Generate a checked-in schema and token module from the
 * document when a typed accessor is required.
 */
export interface DTCGThemeInit {
    /** The derived runtime schema tree. */
    schema: object;
    /** The bare token values described by {@link schema}. */
    tokens: object;
}

/**
 * Pitlane's extension payload for a value DTCG cannot represent.
 *
 * The extension is stored at `$extensions["tools.pitlane"]`. The surrounding
 * node deliberately has no `$value`, making it a valid DTCG group that a
 * strict consumer can ignore rather than a token carrying an invalid surrogate
 * value.
 */
export interface PitlaneDTCGExtension {
    /** The source schema tag, including Pitlane-only `any` and `scale`. */
    type: SchemaTag;
    /** The original authoring value, with exact accessor references reversed. */
    value: unknown;
    /** Why the value has no standard DTCG representation. */
    reason: string;
}

/**
 * DTCG documents exported from a theme.
 */
export interface DTCGExport {
    /** The theme's base document. */
    document: DTCGDocument;
    /** One partial document of token overrides for each theme mode. */
    modes: Record<string, DTCGDocument>;
    /** The number of base and mode values preserved only in Pitlane extensions. */
    inexpressible: number;
}

type ImportTag = TokenType;

interface RawToken {
    key: string;
    path: readonly string[];
    ownTag: ImportTag | undefined;
    inheritedType: TokenType | undefined;
    value: unknown;
}

interface ImportGroup {
    ownType: TokenType | undefined;
    children: Record<string, ImportGroup | RawToken>;
}

interface EncodedToken {
    extension?: PitlaneDTCGExtension;
    type?: TokenType;
    value?: unknown;
}

interface ExportNode {
    children: Map<string, ExportNode>;
    token?: EncodedToken;
}

interface ImportReferenceContext {
    varRefFor(key: string, from: string, expected: TokenType): string;
}

const ACCESSOR_REFERENCE_RE = /^var\((--[a-z0-9-]+)\)$/;
const DIMENSION_RE = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px|rem)$/;
const DURATION_RE = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(ms|s)$/;
const CUBIC_BEZIER_RE =
    /^cubic-bezier\(\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*\)$/;
const HEX_RE = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;

/**
 * Converts a W3C DTCG 2025.10 document into the schema tree and bare token
 * tree {@link createTheme} accepts.
 *
 * A token resolves its type in DTCG order: its own `$type`, the resolved type
 * of a whole-value `{reference}`, then the nearest ancestor group's `$type`.
 * `$description`, `$deprecated`, and `$extensions` are intentionally discarded
 * until schema factories gain a metadata options bag. Typography tokens are not
 * supported because one typography value would need several custom properties.
 *
 * Runtime JSON cannot preserve literal paths, so using this init with
 * {@link createTheme} produces an unbranded accessor. Generate TypeScript from
 * the result for the typed path.
 *
 * @param document - A DTCG document using `$value`, `$type`, and dotted references
 * @returns A runtime {@link ThemeInit}-shaped schema and token tree
 * @throws ThemeError for malformed groups, unsupported typography, unknown types,
 * unresolvable references, cycles, or malformed structured DTCG values
 *
 * @example
 * ```ts
 * import { createTheme } from "@pitlane/theme";
 * import { fromDTCG } from "@pitlane/theme/dtcg";
 *
 * let imported = fromDTCG({
 *     color: {
 *         $type: "color",
 *         white: { $value: "#fff" },
 *         page: { $value: "{color.white}" },
 *     },
 * });
 * let theme = createTheme(imported);
 * ```
 */
export function fromDTCG(document: DTCGDocument): DTCGThemeInit {
    let entries = new Map<string, RawToken>();
    let root = walkDocument(record(document, "$root"), [], undefined, entries);
    let tags = resolveTags(entries);
    let varNames = variableNames(entries.values());
    let context = importReferenceContext(entries, tags, varNames);

    return {
        schema: schemaTree(root, tags),
        tokens: tokenTree(root, tags, context, key => varNames.get(key)),
    };
}

/**
 * Exports a compiled theme, a published theme component, or the init behind
 * either one to W3C DTCG 2025.10 documents.
 *
 * An export places `$type` on the lowest group whose complete descendant set
 * has one expressible type; standard tokens below that group omit the redundant
 * `$type`. Mixed groups put `$type` on their standard token leaves instead.
 * Exact `var(--token-name)` values are converted back to `{token.path}` using
 * the collector's variable-name map.
 *
 * DTCG cannot represent all CSS values this package accepts. Inexpressible
 * values are preserved in `$extensions["tools.pitlane"]` as
 * `{ type, value, reason }`, on an extension-only node with no `$value`; this
 * keeps the standard document valid while preserving the original value for a
 * caller that reports or handles the loss. `inexpressible` counts those nodes in
 * the base document and every mode document.
 *
 * DTCG descriptions, deprecation metadata, and unrelated extensions are not in
 * the authoring format and cannot be recovered.
 *
 * @param theme - A {@link ThemeResult}, its {@link ThemeComponent}, or its init
 * @returns The base document, one partial document per mode, and the lossy-value count
 * @throws ThemeError when the supplied init has an invalid token/schema structure
 *
 * @example
 * ```ts
 * import { createTheme } from "@pitlane/theme";
 * import { toDTCG } from "@pitlane/theme/dtcg";
 * import * as s from "@pitlane/theme/schema";
 *
 * let theme = createTheme({
 *     schema: { color: s.color() },
 *     tokens: { color: { white: "#fff" } },
 * });
 * let { document, inexpressible } = toDTCG(theme);
 * ```
 */
export function toDTCG<T>(theme: ThemeInit | ThemeComponent<T> | ThemeResult<T>): DTCGExport {
    let init = themeInit(theme);
    let schema = init.schema as SchemaNode;
    let baseEntries = collectTokens(init.tokens as Tokens, schema);
    let base = exportDocument(baseEntries, baseEntries);
    let modes: Record<string, DTCGDocument> = {};
    let inexpressible = base.inexpressible;

    for (let [name, mode] of Object.entries(init.modes ?? {})) {
        let entries = collectTokens(mode.tokens as Tokens, schema);
        let exported = exportDocument(entries, baseEntries);
        modes[name] = exported.document;
        inexpressible += exported.inexpressible;
    }

    return { document: base.document, modes, inexpressible };
}

function walkDocument(
    node: Record<string, unknown>,
    path: readonly string[],
    inheritedType: TokenType | undefined,
    entries: Map<string, RawToken>,
): ImportGroup {
    let key = path.length === 0 ? "$root" : path.join(".");
    let ownType = validateType(node.$type, key);
    let effectiveType = ownType ?? inheritedType;
    let group: ImportGroup = { ownType, children: {} };

    for (let [childName, child] of Object.entries(node)) {
        if (childName.startsWith("$")) continue;

        let childPath = [...path, childName];
        let childKey = childPath.join(".");
        validateName(childName, childKey);
        let childRecord = record(child, childKey);
        if ("$value" in childRecord) {
            let ownTag = validateType(childRecord.$type, childKey);
            let token: RawToken = {
                key: childKey,
                path: childPath,
                ownTag,
                inheritedType: effectiveType,
                value: childRecord.$value,
            };
            group.children[childName] = token;
            entries.set(childKey, token);
            continue;
        }

        group.children[childName] = walkDocument(childRecord, childPath, effectiveType, entries);
    }

    return group;
}

function resolveTags(entries: Map<string, RawToken>): Map<string, ImportTag> {
    let tags = new Map<string, ImportTag>();

    for (let key of entries.keys()) tags.set(key, resolveTag(key, entries, []));

    return tags;
}

function resolveTag(
    key: string,
    entries: Map<string, RawToken>,
    chain: readonly string[],
): ImportTag {
    if (chain.includes(key)) throw new ThemeError(`Alias cycle: ${[...chain, key].join(" → ")}`);

    let entry = entries.get(key);
    if (entry === undefined) {
        throw new ThemeError(
            `"${chain[chain.length - 1] ?? key}" references unknown token "${key}"`,
        );
    }
    if (entry.ownTag !== undefined) return entry.ownTag;

    let alias = dtcgAlias(entry.value);
    if (alias !== null) return resolveTag(alias, entries, [...chain, key]);
    if (entry.inheritedType !== undefined) return entry.inheritedType;
    throw new ThemeError(`"${key}" has no resolvable $type`);
}

function variableNames(entries: Iterable<RawToken>): Map<string, string> {
    let byVarName = new Map<string, RawToken>();
    let byKey = new Map<string, string>();

    for (let entry of entries) {
        let varName = `--${entry.path.map(kebabSegment).join("-")}`;
        let existing = byVarName.get(varName);
        if (existing !== undefined) {
            throw new ThemeError(
                `Tokens "${existing.key}" and "${entry.key}" both produce the CSS variable ${varName}`,
            );
        }
        byVarName.set(varName, entry);
        byKey.set(entry.key, varName);
    }

    return byKey;
}

function importReferenceContext(
    entries: Map<string, RawToken>,
    tags: Map<string, ImportTag>,
    varNameByKey: Map<string, string>,
): ImportReferenceContext {
    return {
        varRefFor(key: string, from: string, expected: TokenType): string {
            let target = entries.get(key);
            if (target === undefined)
                throw new ThemeError(`"${from}" references unknown token "${key}"`);

            let type = tags.get(target.key)!;
            if (type !== expected) {
                throw new ThemeError(
                    `"${from}" references "${key}" of type "${type}" where "${expected}" is required`,
                );
            }
            return `var(${varNameByKey.get(target.key)!})`;
        },
    };
}

function schemaTree(root: ImportGroup, tags: Map<string, ImportTag>): Record<string, SchemaNode> {
    let schema: Record<string, SchemaNode> = {};

    for (let [key, child] of Object.entries(root.children)) {
        if (isRawToken(child)) {
            schema[key] = schemaFor(tags.get(child.key)!);
            continue;
        }

        let childSchema = groupSchema(child, root.ownType, tags);
        if (childSchema === undefined) {
            if (root.ownType === undefined) continue;
            schema[key] = schemaFor(root.ownType);
        } else if (child.ownType === undefined && root.ownType !== undefined) {
            schema[key] = s.group(
                schemaFor(root.ownType),
                childSchema as Record<string, SchemaNode>,
            );
        } else {
            schema[key] = childSchema;
        }
    }

    return schema;
}

function groupSchema(
    group: ImportGroup,
    inherited: ImportTag | undefined,
    tags: Map<string, ImportTag>,
): SchemaNode | undefined {
    let effective = group.ownType ?? inherited;
    let children: Record<string, SchemaNode> = {};

    for (let [key, child] of Object.entries(group.children)) {
        if (isRawToken(child)) {
            let tag = tags.get(child.key)!;
            if (tag !== effective) children[key] = schemaFor(tag);
            continue;
        }

        let childSchema = groupSchema(child, effective, tags);
        if (childSchema !== undefined) children[key] = childSchema;
    }

    if (group.ownType === undefined) {
        return Object.keys(children).length === 0 ? undefined : children;
    }

    let self = schemaFor(group.ownType);
    return Object.keys(children).length === 0 ? self : s.group(self, children);
}

function tokenTree(
    group: ImportGroup,
    tags: Map<string, ImportTag>,
    context: ImportReferenceContext,
    varNameFor: (key: string) => string | undefined,
): Tokens {
    let tokens: Tokens = {};

    for (let [key, child] of Object.entries(group.children)) {
        if (isRawToken(child)) {
            tokens[key] = authorValue(child, tags.get(child.key)!, context, varNameFor);
        } else {
            tokens[key] = tokenTree(child, tags, context, varNameFor);
        }
    }

    return tokens;
}

function authorValue(
    entry: RawToken,
    tag: ImportTag,
    context: ImportReferenceContext,
    varNameFor: (key: string) => string | undefined,
): Tokens[string] {
    // An imported document ends up with exactly one reference form, like any
    // hand-written theme.
    let value = convertAliases(entry.value, entry.key, varNameFor);
    if (isTokenValue(value)) return value;

    return serializeValue(tag, value, context, entry.key);
}

function schemaFor(tag: ImportTag): TokenSchema {
    switch (tag) {
        case "color":
            return s.color();
        case "dimension":
            return s.dimension();
        case "duration":
            return s.duration();
        case "number":
            return s.number();
        case "cubicBezier":
            return s.easing();
        case "shadow":
            return s.shadow();
        case "border":
            return s.border();
        case "transition":
            return s.transition();
        case "gradient":
            return s.gradient();
        case "strokeStyle":
            return s.stroke();
        case "fontFamily":
            return s.font.family();
        case "fontWeight":
            return s.font.weight();
    }
}

function exportDocument(
    entries: readonly Entry[],
    referenceEntries: readonly Entry[],
): { document: DTCGDocument; inexpressible: number } {
    let byVarName = new Map<string, Entry>(referenceEntries.map(entry => [entry.varName, entry]));
    let root: ExportNode = { children: new Map() };
    let inexpressible = 0;

    for (let entry of entries) {
        let node = root;
        for (let [index, key] of entry.path.entries()) {
            let child = node.children.get(key);
            if (child === undefined) {
                child = { children: new Map() };
                node.children.set(key, child);
            }
            node = child;
            if (index === entry.path.length - 1) {
                let encoded = encodeToken(entry, byVarName);
                node.token = encoded;
                if (encoded.extension !== undefined) inexpressible += 1;
            }
        }
    }

    return { document: emitDocument(root), inexpressible };
}

function encodeToken(entry: Entry, byVarName: Map<string, Entry>): EncodedToken {
    let value = reverseAccessorReference(entry.value, byVarName);

    if (entry.kind === "untyped") {
        return extensionToken("any", value, "Tokens declared with s.any() have no DTCG type");
    }

    let type = entry.kind === "scale" ? "dimension" : entry.type;
    let encoded = encodeValue(type, value);
    if (encoded === undefined) {
        let sourceTag: SchemaTag = entry.kind === "scale" ? "scale" : entry.type;
        let reason =
            entry.kind === "scale"
                ? "A scale token exports only its base dimension, not multiplier results"
                : inexpressibleReason(type);
        return extensionToken(sourceTag, value, reason);
    }

    return { type, value: encoded };
}

function encodeValue(type: TokenType, value: unknown): unknown {
    if (referenceTarget(value) !== null || dtcgAlias(value) !== null) return value;

    switch (type) {
        case "color":
            return typeof value === "string" ? encodeHexColor(value) : undefined;
        case "dimension":
            return typeof value === "string" ? encodeMeasure(value, DIMENSION_RE) : undefined;
        case "duration":
            return typeof value === "string" ? encodeMeasure(value, DURATION_RE) : undefined;
        case "fontFamily":
            return isFontFamily(value) ? value : undefined;
        case "fontWeight":
            return typeof value === "number" || typeof value === "string" ? value : undefined;
        case "number":
            return typeof value === "number" && Number.isFinite(value) ? value : undefined;
        case "cubicBezier":
            return encodeCubicBezier(value);
        case "strokeStyle":
            return typeof value === "string" ? value : undefined;
        case "shadow":
        case "border":
        case "transition":
        case "gradient":
            return undefined;
    }
}

function encodeHexColor(value: string): DTCGDocument | undefined {
    let match = HEX_RE.exec(value);
    if (match === null) return undefined;

    let hex = match[1]!;
    let pairs =
        hex.length <= 4
            ? (hex.match(/./g) ?? []).map(part => `${part}${part}`)
            : hex.match(/.{2}/g)!;
    let components = pairs.slice(0, 3).map(part => Number.parseInt(part, 16) / 255);
    let alpha = pairs[3] === undefined ? undefined : Number.parseInt(pairs[3], 16) / 255;

    return {
        colorSpace: "srgb",
        components,
        ...(alpha === undefined ? {} : { alpha }),
        hex: value,
    };
}

function encodeMeasure(value: string, expression: RegExp): DTCGDocument | undefined {
    let match = expression.exec(value);
    if (match === null) return undefined;

    let amount = Number(match[1]);
    return Number.isFinite(amount) ? { value: amount, unit: match[2]! } : undefined;
}

function encodeCubicBezier(value: unknown): readonly number[] | undefined {
    if (
        Array.isArray(value) &&
        value.length === 4 &&
        value.every(part => typeof part === "number" && Number.isFinite(part))
    )
        return value;
    if (typeof value !== "string") return undefined;

    let match = CUBIC_BEZIER_RE.exec(value);
    if (match === null) return undefined;
    let parts = match.slice(1).map(Number);
    return parts.every(Number.isFinite) ? parts : undefined;
}

function extensionToken(type: SchemaTag, value: unknown, reason: string): EncodedToken {
    return { extension: { type, value, reason } };
}

function emitDocument(node: ExportNode, inheritedType?: TokenType): DTCGDocument {
    let type = uniformType(node);
    let effectiveType = type ?? inheritedType;
    let document: DTCGDocument = {};

    if (type !== undefined && type !== inheritedType) document.$type = type;

    for (let [key, child] of node.children) {
        if (child.token !== undefined) {
            if (child.token.extension !== undefined) {
                document[key] = { $extensions: { "tools.pitlane": child.token.extension } };
                continue;
            }

            let token: DTCGDocument = { $value: child.token.value };
            if (child.token.type !== effectiveType) token.$type = child.token.type;
            document[key] = token;
            continue;
        }

        document[key] = emitDocument(child, effectiveType);
    }

    return document;
}

function uniformType(node: ExportNode): TokenType | undefined {
    let uniform: TokenType | undefined;
    let isUniform = true;
    let found = false;

    function visit(child: ExportNode): void {
        if (!isUniform) return;
        if (child.token !== undefined) {
            let type = child.token.type;
            if (type === undefined) {
                isUniform = false;
                return;
            }
            if (uniform !== undefined && uniform !== type) {
                isUniform = false;
                return;
            }
            uniform = type;
            found = true;
            return;
        }
        for (let nested of child.children.values()) visit(nested);
    }

    for (let child of node.children.values()) visit(child);
    return isUniform && found ? uniform : undefined;
}

function reverseAccessorReference(value: unknown, byVarName: Map<string, Entry>): unknown {
    if (typeof value !== "string") return value;
    let match = ACCESSOR_REFERENCE_RE.exec(value);
    if (match === null) return value;
    let target = byVarName.get(match[1]!);
    return target === undefined ? value : `{${target.key}}`;
}

function themeInit<T>(theme: ThemeInit | ThemeComponent<T> | ThemeResult<T>): ThemeInit {
    if (typeof theme === "function") return theme.$theme as ThemeInit;
    if ("Theme" in theme) return theme.Theme.$theme as ThemeInit;
    return theme;
}

function validateType(value: unknown, key: string): TokenType | undefined {
    if (value === undefined) return undefined;
    if (value === "typography") {
        throw new ThemeError(`"${key}": typography tokens are not supported in v1`);
    }
    if (!(TOKEN_TYPES as readonly string[]).includes(value as string)) {
        throw new ThemeError(`"${key}" has unknown $type ${JSON.stringify(value)}`);
    }
    return value as TokenType;
}

function validateName(name: string, key: string): void {
    if (/[.{}]/.test(name)) {
        throw new ThemeError(
            `Token or group name "${key}" contains characters reserved by references (".", "{", "}")`,
        );
    }
}

function record(value: unknown, key: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new ThemeError(`"${key}" is neither a group nor a token`);
    }
    return value as Record<string, unknown>;
}

function isRawToken(value: ImportGroup | RawToken): value is RawToken {
    return "key" in value;
}

function isTokenValue(value: unknown): value is Tokens[string] {
    return (
        typeof value === "string" ||
        typeof value === "number" ||
        (Array.isArray(value) &&
            value.every(part => typeof part === "string" || typeof part === "number"))
    );
}

function isFontFamily(value: unknown): value is string | readonly string[] {
    return (
        typeof value === "string" ||
        (Array.isArray(value) && value.every(part => typeof part === "string"))
    );
}

function inexpressibleReason(type: TokenType): string {
    switch (type) {
        case "color":
            return "Only hexadecimal CSS colors can be represented as DTCG color values";
        case "dimension":
            return "Only px and rem dimensions can be represented as DTCG dimension values";
        case "duration":
            return "Only ms and s durations can be represented as DTCG duration values";
        case "fontFamily":
        case "fontWeight":
        case "number":
        case "cubicBezier":
        case "strokeStyle":
            return "The value is outside the DTCG value grammar";
        case "shadow":
        case "border":
        case "transition":
        case "gradient":
            return "CSS composite text has no DTCG representation";
    }
}
