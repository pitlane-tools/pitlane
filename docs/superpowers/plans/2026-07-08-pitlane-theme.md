# @pitlane/theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@pitlane/theme@0.1.0` — DTCG design tokens in, branded token accessor + `<Theme />` component + brand-enforced `css`/`tva`/`cx`/`combine` out — with tests, VitePress docs, and a release-triggered publish workflow.

**Architecture:** Pure runtime library, zero runtime dependencies. `createTheme` parses a W3C DTCG token document at module init (parse → resolve → serialize → emit), returns `{ token, raw, Theme }`. Brand types (12 `unique symbol` string brands, one per DTCG type) make the module-level `css()`/`tva()` statically safe without knowing any theme's config type. All styling delegates to remix/ui's `css()` mixin.

**Tech Stack:** TypeScript (no JSX in package source — `createElement` only), Vite+ (`vp pack` build with tsgo dts, `vp test` = Vitest with tsgo typecheck), pnpm workspace, `remix@3.0.0-beta.5` as peer/dev dependency.

**Spec:** `docs/superpowers/specs/2026-07-08-pitlane-theme-design.md` — the authoritative design. When this plan and the spec disagree, the spec wins.

## Global Constraints

- Node 24 (`.node-version` = `24`); ESM only (`"type": "module"`).
- `@pitlane/theme` has **zero runtime dependencies**; `peerDependencies: { "remix": "*" }`; `devDependencies: { "remix": "3.0.0-beta.5" }`.
- Package source is `.ts` only — no `.tsx`, no JSX; the `Theme` component uses `createElement` from `remix/ui`.
- Relative imports carry the `.ts` extension (root lint rule `import/extensions: always`).
- Repo formatting: 4-space indent, print width 100, `arrowParens: avoid`, `let` over `const` for locals (match maitre-d/remix-fork style in examples; repo fmt is authoritative).
- Do **not** run repo-wide `vp fmt`/`vp lint` per task; the final task (Task 13) runs them once. Per-task verification is `vp test` scoped to the package.
- All commands for the package run from `packages/theme/` unless stated otherwise.
- Commit messages: plain imperative sentences (`Add theme token parser`), matching repo history — no conventional-commit prefixes.
- Error messages: every `ThemeError` names the offending token path (dot-joined key like `color.gray.900`).
- Var naming: `--` + path segments kebab-cased and joined with `-`; kebab rule: split camelCase, lowercase, collapse `[^a-z0-9]+` runs to `-`, trim leading/trailing `-`.

---

### Task 1: Workspace conversion + package scaffold

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `packages/theme/package.json`
- Create: `packages/theme/tsconfig.json`
- Create: `packages/theme/vite.config.ts`
- Create: `packages/theme/src/index.ts` (placeholder export, replaced in Task 11)
- Create: `packages/theme/src/index.test.ts` (scaffold smoke test, extended in Task 11)
- Modify: root `vite.config.ts` (fmt/lint ignorePatterns)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a workspace where `vp test` and `vp run build` work inside `packages/theme/`; `remix` installed so later tasks can `import { css, createElement } from "remix/ui"` and `import { renderToString } from "remix/ui/server"`.

- [ ] **Step 1: Create the workspace file**

Create `pnpm-workspace.yaml` at the repo root:

```yaml
packages:
    - packages/*
```

- [ ] **Step 2: Create the package manifest**

Create `packages/theme/package.json`:

```json
{
    "name": "@pitlane/theme",
    "version": "0.1.0",
    "description": "Type-safe styling with W3C design tokens for Remix 3.",
    "homepage": "https://docs.pitlane.tools/package/theme",
    "bugs": {
        "url": "https://github.com/pitlane-tools/docs/issues"
    },
    "license": "MIT",
    "author": "Mark Malstrom <mark@malstrom.me>",
    "repository": {
        "type": "git",
        "url": "git+https://github.com/pitlane-tools/docs.git",
        "directory": "packages/theme"
    },
    "files": [
        "dist"
    ],
    "type": "module",
    "types": "./dist/index.d.mts",
    "exports": {
        ".": {
            "types": "./dist/index.d.mts",
            "import": "./dist/index.mjs"
        }
    },
    "scripts": {
        "prepublishOnly": "vp run build"
    },
    "devDependencies": {
        "remix": "3.0.0-beta.5"
    },
    "peerDependencies": {
        "remix": "*"
    }
}
```

- [ ] **Step 3: Create the package tsconfig**

Create `packages/theme/tsconfig.json` (standalone — the root tsconfig serves VitePress):

```json
{
    "compilerOptions": {
        "target": "esnext",
        "lib": ["esnext"],
        "moduleDetection": "force",
        "module": "preserve",
        "moduleResolution": "bundler",
        "strict": true,
        "noUnusedLocals": true,
        "declaration": true,
        "allowImportingTsExtensions": true,
        "emitDeclarationOnly": true,
        "isolatedModules": true,
        "verbatimModuleSyntax": true,
        "skipLibCheck": true
    },
    "include": ["src"]
}
```

- [ ] **Step 4: Create the package Vite+ config**

Create `packages/theme/vite.config.ts`:

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
    pack: [
        {
            entry: { index: "src/index.ts" },
            dts: { tsgo: true },
        },
    ],
    run: {
        tasks: {
            dev: { command: "vp pack --watch" },
            build: { command: "vp pack" },
        },
    },
    test: {
        include: ["**/*.test.ts"],
        typecheck: {
            enabled: true,
            checker: "tsgo",
            tsconfig: "tsconfig.json",
        },
    },
});
```

- [ ] **Step 5: Create placeholder entry + smoke test**

Create `packages/theme/src/index.ts`:

```ts
export const VERSION = "0.1.0";
```

Create `packages/theme/src/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { VERSION } from "./index.ts";

describe("package scaffold", () => {
    it("resolves the module", () => {
        expect(VERSION).toBe("0.1.0");
    });
});
```

- [ ] **Step 6: Extend root ignore patterns**

In the root `vite.config.ts`, add `"packages/*/dist/**"` to **both** `fmt.ignorePatterns` and `lint.ignorePatterns` arrays (keep existing entries).

- [ ] **Step 7: Install and verify the workspace**

Run at the repo root: `vp install`
Expected: lockfile updates; `@pitlane/theme` linked; `remix@3.0.0-beta.5` installed.

Run in `packages/theme/`: `vp test`
Expected: PASS — 1 test file, 1 test (plus typecheck pass).

- [ ] **Step 8: Verify the remix/ui import surface this package depends on**

Run in `packages/theme/`:

```bash
node -e "Promise.all([import('remix/ui'), import('remix/ui/server')]).then(([ui, server]) => console.log(typeof ui.css, typeof ui.createElement, typeof server.renderToString))"
```

Expected output: `function function function`.
If `remix/ui/server` fails to resolve, check `node_modules/remix/package.json` `exports` for the server subpath actually exposed (e.g. `remix/ui/server.js` or similar) and use that specifier everywhere this plan says `remix/ui/server` — record the change in the task's commit message.

- [ ] **Step 9: Commit**

```bash
git add pnpm-workspace.yaml packages/theme vite.config.ts pnpm-lock.yaml
git commit -m "Convert repo to workspace and scaffold @pitlane/theme"
```

---

### Task 2: Brand types, DTCG document types, TokenTree

**Files:**
- Create: `packages/theme/src/brands.ts`
- Create: `packages/theme/src/types.ts`
- Test: `packages/theme/src/types.test-d.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by every later task):
  - `brands.ts`: `TOKEN_TYPES: readonly TokenType[]`, `type TokenType`, the 12 brand types `ColorToken | DimensionToken | DurationToken | FontFamilyToken | FontWeightToken | NumberToken | CubicBezierToken | ShadowToken | BorderToken | TransitionToken | GradientToken | StrokeStyleToken`, `interface BrandByType`, `type AnyToken` (union of all 12).
  - `types.ts`: `interface TokenNode`, `interface TokenGroup`, `type DTCGDocument`, `type TokenTree<T>`, `type DeepPartialTokens<T>`.

- [ ] **Step 1: Write the failing type test**

Create `packages/theme/src/types.test-d.ts`:

```ts
import { describe, expectTypeOf, it } from "vitest";

import type { ColorToken, DimensionToken, ShadowToken } from "./brands.ts";
import type { DeepPartialTokens, TokenTree } from "./types.ts";

const config = {
    color: {
        $type: "color",
        white: { $value: "#fff" },
        gray: { 50: { $value: "#fafafa" }, 900: { $value: "#171717" } },
        bg: { $value: "{color.white}" },
    },
    space: {
        $type: "dimension",
        md: { $value: { value: 16, unit: "px" } },
    },
    shadow: {
        card: {
            $type: "shadow",
            $value: { color: "{color.gray.900}", offsetX: "0px", offsetY: "1px", blur: "3px", spread: "0px" },
        },
    },
    accent: { $type: "color", $value: "#f0f" },
} as const;

type Tree = TokenTree<typeof config>;

describe("TokenTree", () => {
    it("brands leaves by group-inherited $type", () => {
        expectTypeOf<Tree["color"]["white"]>().toEqualTypeOf<ColorToken>();
        expectTypeOf<Tree["color"]["gray"][900]>().toEqualTypeOf<ColorToken>();
        expectTypeOf<Tree["space"]["md"]>().toEqualTypeOf<DimensionToken>();
    });

    it("brands leaves by own $type", () => {
        expectTypeOf<Tree["shadow"]["card"]>().toEqualTypeOf<ShadowToken>();
        expectTypeOf<Tree["accent"]>().toEqualTypeOf<ColorToken>();
    });

    it("brands alias leaves by the target's resolved type", () => {
        expectTypeOf<Tree["color"]["bg"]>().toEqualTypeOf<ColorToken>();
    });

    it("keeps brands nominal", () => {
        expectTypeOf<Tree["color"]["white"]>().not.toEqualTypeOf<DimensionToken>();
        expectTypeOf<ColorToken>().toMatchTypeOf<string>();
        // A plain string is not a ColorToken
        expectTypeOf<string>().not.toMatchTypeOf<ColorToken>();
    });
});

describe("DeepPartialTokens", () => {
    it("accepts a partial override of $value only", () => {
        expectTypeOf<{
            color?: { bg?: { $value: unknown } };
        }>().toMatchTypeOf<DeepPartialTokens<typeof config>>();
    });

    it("rejects unknown paths", () => {
        expectTypeOf<{ nope: { $value: string } }>().not.toMatchTypeOf<DeepPartialTokens<typeof config>>();
    });
});

describe("typography", () => {
    it("brands typography leaves as never (unsupported in v1)", () => {
        type Typo = TokenTree<{ heading: { $type: "typography"; $value: object } }>;
        expectTypeOf<Typo["heading"]>().toBeNever();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run in `packages/theme/`: `vp test`
Expected: FAIL — typecheck errors: cannot find module `./brands.ts` / `./types.ts`.

- [ ] **Step 3: Implement `brands.ts`**

Create `packages/theme/src/brands.ts`:

```ts
export const TOKEN_TYPES = [
    "color",
    "dimension",
    "duration",
    "fontFamily",
    "fontWeight",
    "number",
    "cubicBezier",
    "shadow",
    "border",
    "transition",
    "gradient",
    "strokeStyle",
] as const;

export type TokenType = (typeof TOKEN_TYPES)[number];

// The symbols are declared, never created — they exist only in the type system,
// which keeps every brand a plain string at runtime.
declare const COLOR: unique symbol;
declare const DIMENSION: unique symbol;
declare const DURATION: unique symbol;
declare const FONT_FAMILY: unique symbol;
declare const FONT_WEIGHT: unique symbol;
declare const NUMBER: unique symbol;
declare const CUBIC_BEZIER: unique symbol;
declare const SHADOW: unique symbol;
declare const BORDER: unique symbol;
declare const TRANSITION: unique symbol;
declare const GRADIENT: unique symbol;
declare const STROKE_STYLE: unique symbol;

export type ColorToken = string & { readonly [COLOR]: true };
export type DimensionToken = string & { readonly [DIMENSION]: true };
export type DurationToken = string & { readonly [DURATION]: true };
export type FontFamilyToken = string & { readonly [FONT_FAMILY]: true };
export type FontWeightToken = string & { readonly [FONT_WEIGHT]: true };
export type NumberToken = string & { readonly [NUMBER]: true };
export type CubicBezierToken = string & { readonly [CUBIC_BEZIER]: true };
export type ShadowToken = string & { readonly [SHADOW]: true };
export type BorderToken = string & { readonly [BORDER]: true };
export type TransitionToken = string & { readonly [TRANSITION]: true };
export type GradientToken = string & { readonly [GRADIENT]: true };
export type StrokeStyleToken = string & { readonly [STROKE_STYLE]: true };

export interface BrandByType {
    color: ColorToken;
    dimension: DimensionToken;
    duration: DurationToken;
    fontFamily: FontFamilyToken;
    fontWeight: FontWeightToken;
    number: NumberToken;
    cubicBezier: CubicBezierToken;
    shadow: ShadowToken;
    border: BorderToken;
    transition: TransitionToken;
    gradient: GradientToken;
    strokeStyle: StrokeStyleToken;
}

export type AnyToken = BrandByType[TokenType];
```

- [ ] **Step 4: Implement `types.ts`**

Create `packages/theme/src/types.ts`:

```ts
import type { BrandByType, TokenType } from "./brands.ts";

export interface TokenNode {
    $value: unknown;
    $type?: TokenType;
    $description?: string;
    $extensions?: Record<string, unknown>;
    $deprecated?: boolean | string;
}

export interface TokenGroup {
    $type?: TokenType;
    $description?: string;
    $extensions?: Record<string, unknown>;
    [key: string]: unknown;
}

export type DTCGDocument = TokenGroup;

type GroupType<N, Inherited> = N extends { $type: infer Ty extends TokenType } ? Ty : Inherited;

type BrandOf<Ty> = Ty extends TokenType ? BrandByType[Ty] : never;

type TokenTypeOf<N, Root, Inherited> = N extends { $type: infer Ty extends TokenType }
    ? Ty
    : N extends { $value: `{${infer P}}` }
      ? TypeAtPath<Root, P, Root, undefined>
      : Inherited extends TokenType
        ? Inherited
        : never;

type TypeAtPath<N, P extends string, Root, Inherited> = P extends `${infer Head}.${infer Rest}`
    ? Head extends keyof N
        ? TypeAtPath<N[Head], Rest, Root, GroupType<N[Head], Inherited>>
        : never
    : P extends keyof N
      ? TokenTypeOf<N[P], Root, Inherited>
      : never;

type TreeOf<N, Root, Inherited> = {
    [K in Exclude<keyof N, `$${string}`>]: N[K] extends { $value: unknown }
        ? BrandOf<TokenTypeOf<N[K], Root, Inherited>>
        : TreeOf<N[K], Root, GroupType<N[K], Inherited>>;
};

/** Same-shape accessor type: token leaves become branded `var()` strings. */
export type TokenTree<T> = TreeOf<T, T, undefined>;

/** Mode override shape: every group optional, token nodes reduced to `{ $value }`. */
export type DeepPartialTokens<T> = {
    [K in Exclude<keyof T, `$${string}`>]?: T[K] extends { $value: unknown }
        ? { $value: unknown }
        : DeepPartialTokens<T[K]>;
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run in `packages/theme/`: `vp test`
Expected: PASS — runtime suite (scaffold test) and typecheck suite (`types.test-d.ts`) both green.

Note: numeric config keys (`gray: { 50: … }`) surface as *number* keys under a `const` type parameter/`as const`, which is why the test indexes `Tree["color"]["gray"][900]` without quotes. If tsgo reports the key as `"900"` instead, index with the string form in the test — both spellings must resolve to `ColorToken`.

- [ ] **Step 6: Commit**

```bash
git add src/brands.ts src/types.ts src/types.test-d.ts
git commit -m "Add token brand types and DTCG document types"
```

---

### Task 3: Token parsing and resolution (`tokens.ts`)

**Files:**
- Create: `packages/theme/src/tokens.ts`
- Test: `packages/theme/src/tokens.test.ts`

**Interfaces:**
- Consumes: `TOKEN_TYPES`, `TokenType` from `./brands.ts`; `DTCGDocument` from `./types.ts`.
- Produces (used by Tasks 4–6):
  - `class ThemeError extends Error`
  - `aliasTarget(value: unknown): string | null` — `"{a.b}"` → `"a.b"`, else `null`
  - `kebabSegment(segment: string): string`
  - `interface ParsedToken { key: string; path: readonly string[]; varName: string; type: TokenType; value: unknown; aliasOf?: string }`
  - `parseTokens(document: DTCGDocument): Map<string, ParsedToken>` — insertion-ordered, keyed by dot-path

- [ ] **Step 1: Write the failing tests**

Create `packages/theme/src/tokens.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { aliasTarget, kebabSegment, parseTokens, ThemeError } from "./tokens.ts";

describe("aliasTarget", () => {
    it("extracts full-value alias paths", () => {
        expect(aliasTarget("{color.white}")).toBe("color.white");
    });

    it("returns null for non-aliases", () => {
        expect(aliasTarget("#fff")).toBe(null);
        expect(aliasTarget("{a.b} extra")).toBe(null);
        expect(aliasTarget(16)).toBe(null);
    });
});

describe("kebabSegment", () => {
    it("splits camelCase and lowercases", () => {
        expect(kebabSegment("backgroundHover")).toBe("background-hover");
    });

    it("passes numeric segments through", () => {
        expect(kebabSegment("900")).toBe("900");
    });

    it("collapses invalid characters", () => {
        expect(kebabSegment("Brand Blue!")).toBe("brand-blue");
    });

    it("throws when a segment collapses to nothing", () => {
        expect(() => kebabSegment("***")).toThrow(ThemeError);
    });
});

describe("parseTokens", () => {
    it("walks groups and inherits $type", () => {
        let tokens = parseTokens({
            color: { $type: "color", gray: { 900: { $value: "#171717" } } },
        });
        let token = tokens.get("color.gray.900");
        expect(token).toMatchObject({
            key: "color.gray.900",
            path: ["color", "gray", "900"],
            varName: "--color-gray-900",
            type: "color",
            value: "#171717",
        });
    });

    it("prefers a token's own $type over the inherited one", () => {
        let tokens = parseTokens({
            misc: { $type: "color", weight: { $type: "fontWeight", $value: 700 } },
        });
        expect(tokens.get("misc.weight")?.type).toBe("fontWeight");
    });

    it("resolves alias token types from the target", () => {
        let tokens = parseTokens({
            color: { $type: "color", white: { $value: "#fff" } },
            bg: { $value: "{color.white}" },
        });
        let bg = tokens.get("bg");
        expect(bg?.type).toBe("color");
        expect(bg?.aliasOf).toBe("color.white");
    });

    it("prefers the alias target's type over a group-inherited $type (DTCG order)", () => {
        let tokens = parseTokens({
            motion: { $type: "duration", fast: { $value: "150ms" } },
            color: { $type: "color", pulse: { $value: "{motion.fast}" } },
        });
        expect(tokens.get("color.pulse")?.type).toBe("duration");
    });

    it("resolves alias chains", () => {
        let tokens = parseTokens({
            a: { $type: "color", $value: "#fff" },
            b: { $value: "{a}" },
            c: { $value: "{b}" },
        });
        expect(tokens.get("c")?.type).toBe("color");
    });

    it("throws on a token with no resolvable $type", () => {
        expect(() => parseTokens({ orphan: { $value: "#fff" } })).toThrow(/orphan/);
    });

    it("throws on unknown $type", () => {
        expect(() => parseTokens({ x: { $type: "sparkles" as never, $value: 1 } })).toThrow(/sparkles/);
    });

    it("rejects typography tokens with a dedicated message", () => {
        expect(() =>
            parseTokens({ heading: { $type: "typography" as never, $value: {} } }),
        ).toThrow(/typography tokens are not supported/);
    });

    it("throws on an alias to a nonexistent token", () => {
        expect(() => parseTokens({ bg: { $value: "{color.white}" } })).toThrow(/color\.white/);
    });

    it("throws on alias type cycles, reporting the chain", () => {
        expect(() => parseTokens({ a: { $value: "{b}" }, b: { $value: "{a}" } })).toThrow(
            /a → b → a/,
        );
    });

    it("throws on var-name collisions, reporting both paths", () => {
        let error = getError(() =>
            parseTokens({
                color: { $type: "color", "brand blue": { $value: "#00f" }, brandBlue: { $value: "#00e" } },
            }),
        );
        expect(error).toBeInstanceOf(ThemeError);
        expect(error.message).toContain("color.brand blue");
        expect(error.message).toContain("color.brandBlue");
    });

    it("ignores $description, $extensions, and $deprecated", () => {
        let tokens = parseTokens({
            color: {
                $type: "color",
                $description: "palette",
                $extensions: { "com.example": true },
                white: { $value: "#fff", $description: "pure", $deprecated: true },
            },
        });
        expect(tokens.get("color.white")?.value).toBe("#fff");
    });

    it("throws on non-object, non-token members", () => {
        expect(() => parseTokens({ color: { white: "#fff" } } as never)).toThrow(/color\.white/);
    });
});

function getError(fn: () => unknown): Error {
    try {
        fn();
    } catch (error) {
        return error as Error;
    }
    throw new Error("expected function to throw");
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run in `packages/theme/`: `vp test`
Expected: FAIL — cannot find module `./tokens.ts`.

- [ ] **Step 3: Implement `tokens.ts`**

Create `packages/theme/src/tokens.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run in `packages/theme/`: `vp test`
Expected: PASS — all `tokens.test.ts` cases plus prior suites.

- [ ] **Step 5: Commit**

```bash
git add src/tokens.ts src/tokens.test.ts
git commit -m "Add DTCG token parser with alias and collision validation"
```

---

### Task 4: Value serializers (`serialize.ts`)

**Files:**
- Create: `packages/theme/src/serialize.ts`
- Test: `packages/theme/src/serialize.test.ts`

**Interfaces:**
- Consumes: `TokenType` from `./brands.ts`; `ThemeError`, `aliasTarget` from `./tokens.ts`.
- Produces (used by Tasks 5–6):
  - `interface SerializeContext { varRefFor(key: string, from: string): string }` — returns `var(--…)` for a dot-path, throws `ThemeError` naming `from` when the path is unknown.
  - `serializeValue(type: TokenType, value: unknown, ctx: SerializeContext, key: string): string`

- [ ] **Step 1: Write the failing tests**

Create `packages/theme/src/serialize.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { serializeValue } from "./serialize.ts";
import { ThemeError } from "./tokens.ts";
import type { SerializeContext } from "./serialize.ts";

const ctx: SerializeContext = {
    varRefFor(key, from) {
        if (key === "color.white") return "var(--color-white)";
        throw new ThemeError(`"${from}" references unknown token "${key}"`);
    },
};

function run(type: Parameters<typeof serializeValue>[0], value: unknown): string {
    return serializeValue(type, value, ctx, "test.token");
}

describe("color", () => {
    it("passes strings through", () => {
        expect(run("color", "#fff")).toBe("#fff");
        expect(run("color", "rgb(0 0 0)")).toBe("rgb(0 0 0)");
    });

    it("prefers hex on structured values", () => {
        expect(run("color", { colorSpace: "srgb", components: [1, 1, 1], hex: "#ffffff" })).toBe(
            "#ffffff",
        );
    });

    it("serializes function color spaces", () => {
        expect(run("color", { colorSpace: "hsl", components: [120, 50, 60] })).toBe(
            "hsl(120 50% 60%)",
        );
        expect(run("color", { colorSpace: "hwb", components: [30, 10, 20] })).toBe(
            "hwb(30 10% 20%)",
        );
        expect(run("color", { colorSpace: "oklch", components: [0.7, 0.1, 250] })).toBe(
            "oklch(0.7 0.1 250)",
        );
        expect(run("color", { colorSpace: "lab", components: [50, 20, -30] })).toBe(
            "lab(50 20 -30)",
        );
    });

    it("serializes color() spaces with alpha and none", () => {
        expect(
            run("color", { colorSpace: "display-p3", components: [1, 0, "none"], alpha: 0.5 }),
        ).toBe("color(display-p3 1 0 none / 0.5)");
        expect(run("color", { colorSpace: "srgb", components: [1, 0, 0] })).toBe(
            "color(srgb 1 0 0)",
        );
    });

    it("throws on unknown color spaces", () => {
        expect(() => run("color", { colorSpace: "cmyk", components: [0, 0, 0, 0] })).toThrow(
            /cmyk/,
        );
    });
});

describe("dimension and duration", () => {
    it("accepts legacy strings and structured objects", () => {
        expect(run("dimension", "16px")).toBe("16px");
        expect(run("dimension", { value: 1.5, unit: "rem" })).toBe("1.5rem");
        expect(run("duration", "200ms")).toBe("200ms");
        expect(run("duration", { value: 2, unit: "s" })).toBe("2s");
    });

    it("throws on unknown units", () => {
        expect(() => run("dimension", { value: 4, unit: "em" })).toThrow(/test\.token/);
        expect(() => run("duration", { value: 4, unit: "min" })).toThrow(/test\.token/);
    });
});

describe("fontFamily", () => {
    it("quotes names that need it and joins arrays", () => {
        expect(run("fontFamily", "monospace")).toBe("monospace");
        expect(run("fontFamily", ["Helvetica Neue", "sans-serif"])).toBe(
            '"Helvetica Neue", sans-serif',
        );
    });
});

describe("fontWeight", () => {
    it("passes numbers and maps keywords", () => {
        expect(run("fontWeight", 400)).toBe("400");
        expect(run("fontWeight", "semi-bold")).toBe("600");
        expect(run("fontWeight", "extra-black")).toBe("950");
    });

    it("throws on out-of-range numbers and unknown keywords", () => {
        expect(() => run("fontWeight", 0)).toThrow(/test\.token/);
        expect(() => run("fontWeight", "chonky")).toThrow(/chonky/);
    });
});

describe("number and cubicBezier", () => {
    it("serializes", () => {
        expect(run("number", 0.5)).toBe("0.5");
        expect(run("cubicBezier", [0.4, 0, 0.2, 1])).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
    });

    it("throws on malformed values", () => {
        expect(() => run("number", "1")).toThrow(/test\.token/);
        expect(() => run("cubicBezier", [1, 2, 3])).toThrow(/test\.token/);
    });
});

describe("shadow", () => {
    it("serializes a single shadow with defaults", () => {
        expect(
            run("shadow", { color: "#000", offsetX: "0px", offsetY: "1px" }),
        ).toBe("0px 1px 0 0 #000");
    });

    it("serializes inset, arrays, and sub-value aliases", () => {
        expect(
            run("shadow", [
                {
                    color: "{color.white}",
                    offsetX: "0px",
                    offsetY: "1px",
                    blur: "3px",
                    spread: "0px",
                    inset: true,
                },
                { color: "#000", offsetX: { value: 0, unit: "px" }, offsetY: "2px" },
            ]),
        ).toBe("inset 0px 1px 3px 0px var(--color-white), 0px 2px 0 0 #000");
    });
});

describe("border, transition, gradient, strokeStyle", () => {
    it("serializes border", () => {
        expect(
            run("border", { color: "{color.white}", width: "1px", style: "solid" }),
        ).toBe("1px solid var(--color-white)");
    });

    it("serializes transition with default delay", () => {
        expect(
            run("transition", { duration: "200ms", timingFunction: [0.4, 0, 0.2, 1] }),
        ).toBe("200ms cubic-bezier(0.4, 0, 0.2, 1) 0s");
        expect(
            run("transition", { duration: "200ms", timingFunction: [0, 0, 1, 1], delay: "50ms" }),
        ).toBe("200ms cubic-bezier(0, 0, 1, 1) 50ms");
    });

    it("serializes gradient stop lists", () => {
        expect(
            run("gradient", [
                { color: "#fff", position: 0 },
                { color: "{color.white}", position: 1 },
            ]),
        ).toBe("#fff 0%, var(--color-white) 100%");
    });

    it("serializes strokeStyle keywords and the object fallback", () => {
        expect(run("strokeStyle", "dotted")).toBe("dotted");
        expect(run("strokeStyle", { dashArray: ["2px"], lineCap: "round" })).toBe("dashed");
        expect(() => run("strokeStyle", "wavy")).toThrow(/test\.token/);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run in `packages/theme/`: `vp test`
Expected: FAIL — cannot find module `./serialize.ts`.

- [ ] **Step 3: Implement `serialize.ts`**

Create `packages/theme/src/serialize.ts`:

```ts
import { aliasTarget, ThemeError } from "./tokens.ts";
import type { TokenType } from "./brands.ts";

export interface SerializeContext {
    varRefFor(key: string, from: string): string;
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

function field(
    type: TokenType,
    value: unknown,
    ctx: SerializeContext,
    key: string,
): string {
    let alias = aliasTarget(value);
    if (alias !== null) return ctx.varRefFor(alias, key);
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
            if (typeof position !== "number") throw invalid(key, "gradient stop position", position);
            return `${field("color", color, ctx, key)} ${position * 100}%`;
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
```

Note: gradient stop `position` must be a literal number 0–1 (aliases are supported for stop `color` only — a `var()` of a number token cannot be multiplied into a percentage). This matches the spec's serializer table.

- [ ] **Step 4: Run tests to verify they pass**

Run in `packages/theme/`: `vp test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/serialize.ts src/serialize.test.ts
git commit -m "Add DTCG value serializers"
```

---

### Task 5: `createTheme` core — accessor, raw, emission (`theme.ts`, no modes yet)

**Files:**
- Create: `packages/theme/src/theme.ts`
- Test: `packages/theme/src/theme.test.ts`

**Interfaces:**
- Consumes: `parseTokens`, `ThemeError`, `aliasTarget`, `ParsedToken` from `./tokens.ts`; `serializeValue`, `SerializeContext` from `./serialize.ts`; `DTCGDocument`, `TokenTree`, `DeepPartialTokens` from `./types.ts`; `AnyToken` from `./brands.ts`.
- Produces (Tasks 6–7 extend this file; Tasks 8–12 consume the API):
  - `interface ThemeOptions<T> { modes?: { light?: DeepPartialTokens<T>; dark?: DeepPartialTokens<T> } }` (modes implemented in Task 6)
  - `interface ThemeResult<T> { token: TokenTree<T>; raw(ref: AnyToken): string; Theme: ThemeComponent }`
  - `type ThemeComponent` (implemented as a stub type here; real component in Task 7)
  - `createTheme<const T extends DTCGDocument>(config: T, options?: ThemeOptions<T>): ThemeResult<T>`
  - Internal (module-private, but Task 6/7 steps edit this file): `buildCssText(...): string`

- [ ] **Step 1: Write the failing tests**

Create `packages/theme/src/theme.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createTheme } from "./theme.ts";
import { ThemeError } from "./tokens.ts";

const config = {
    color: {
        $type: "color",
        white: { $value: "#fff" },
        gray: { 900: { $value: "#171717" } },
        bg: { $value: "{color.white}" },
    },
    space: { $type: "dimension", md: { $value: { value: 16, unit: "px" } } },
} as const;

describe("createTheme token accessor", () => {
    it("mirrors the config shape with var() leaves", () => {
        let { token } = createTheme(config);
        expect(token.color.white).toBe("var(--color-white)");
        expect(token.color.gray[900]).toBe("var(--color-gray-900)");
        expect(token.color.bg).toBe("var(--color-bg)");
        expect(token.space.md).toBe("var(--space-md)");
    });
});

describe("raw", () => {
    it("returns serialized base values, chasing aliases", () => {
        let { token, raw } = createTheme(config);
        expect(raw(token.color.white)).toBe("#fff");
        expect(raw(token.color.bg)).toBe("#fff");
        expect(raw(token.space.md)).toBe("16px");
    });

    it("throws on refs not minted by this theme", () => {
        let { raw } = createTheme(config);
        expect(() => raw("var(--other)" as never)).toThrow(ThemeError);
    });

    it("throws on alias value cycles even when types resolve", () => {
        expect(() =>
            createTheme({
                a: { $type: "color", $value: "{b}" },
                b: { $type: "color", $value: "{a}" },
            }),
        ).toThrow(/a → b → a/);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run in `packages/theme/`: `vp test`
Expected: FAIL — cannot find module `./theme.ts`.

- [ ] **Step 3: Implement `theme.ts` (accessor + raw + css text, single-mode)**

Create `packages/theme/src/theme.ts`:

```ts
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
```

Note on `aliasTarget` import: it is unused in this task's version of the file and gets used in Task 6 — if `noUnusedLocals` flags it, drop the import now and re-add it in Task 6.

- [ ] **Step 4: Run tests to verify they pass**

Run in `packages/theme/`: `vp test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/theme.ts src/theme.test.ts
git commit -m "Add createTheme accessor, raw lookup, and base CSS emission"
```

---

### Task 6: Modes — `prefers-color-scheme` overrides

**Files:**
- Modify: `packages/theme/src/theme.ts` (add mode parsing/validation + a testable `compileThemeCss`)
- Test: `packages/theme/src/theme.test.ts` (append)

**Interfaces:**
- Consumes: Task 5's `theme.ts` internals.
- Produces: `compileThemeCss<const T extends DTCGDocument>(config: T, options?: ThemeOptions<T>): string` — exported from `theme.ts` for tests and internal use by `createTheme`; **not** re-exported from `index.ts`. Mode blocks emit as `@media (prefers-color-scheme: <mode>) { :root { … } }`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/theme/src/theme.test.ts`:

```ts
import { compileThemeCss } from "./theme.ts";

describe("modes", () => {
    it("emits base :root plus prefers-color-scheme blocks with only overridden vars", () => {
        let css = compileThemeCss(config, {
            modes: { dark: { color: { bg: { $value: "{color.gray.900}" } } } },
        });
        expect(css).toBe(
            [
                ":root {",
                "    --color-white: #fff;",
                "    --color-gray-900: #171717;",
                "    --color-bg: var(--color-white);",
                "    --space-md: 16px;",
                "}",
                "",
                "@media (prefers-color-scheme: dark) {",
                "    :root {",
                "        --color-bg: var(--color-gray-900);",
                "    }",
                "}",
            ].join("\n"),
        );
    });

    it("supports light and dark simultaneously, in light-then-dark order", () => {
        let css = compileThemeCss(config, {
            modes: {
                dark: { color: { white: { $value: "#000" } } },
                light: { color: { white: { $value: "#fefefe" } } },
            },
        });
        let lightIndex = css.indexOf("prefers-color-scheme: light");
        let darkIndex = css.indexOf("prefers-color-scheme: dark");
        expect(lightIndex).toBeGreaterThan(-1);
        expect(darkIndex).toBeGreaterThan(lightIndex);
        expect(css).toContain("        --color-white: #fefefe;");
        expect(css).toContain("        --color-white: #000;");
    });

    it("throws when an override path does not exist in the base document", () => {
        expect(() =>
            compileThemeCss(config, {
                modes: { dark: { color: { nope: { $value: "#000" } } } } as never,
            }),
        ).toThrow(/color\.nope/);
    });

    it("throws when an override sets anything but $value", () => {
        expect(() =>
            compileThemeCss(config, {
                modes: {
                    dark: { color: { bg: { $value: "#000", $type: "color" } } } as never,
                },
            }),
        ).toThrow(/may only set \$value/);
    });

    it("throws when an override aliases a token missing from the base", () => {
        expect(() =>
            compileThemeCss(config, {
                modes: { dark: { color: { bg: { $value: "{color.void}" } } } },
            }),
        ).toThrow(/color\.void/);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run in `packages/theme/`: `vp test`
Expected: FAIL — `compileThemeCss` is not exported.

- [ ] **Step 3: Implement mode compilation**

In `packages/theme/src/theme.ts`:

1. Extract the token→declarations work from `createTheme` into a shared internal, and add mode handling. Replace the body of `createTheme` and add `compileThemeCss` + helpers so the file's compile path reads:

```ts
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
```

2. Rewrite `createTheme` to consume `compile()` (raw/accessor logic unchanged from Task 5, now reading `compiled.tokens`/`compiled.ctx`/`compiled.cssText`; delete the `void cssText` line — `cssText` stays local until Task 7 hands it to the component). This makes `aliasTarget` a used import.

- [ ] **Step 4: Run tests to verify they pass**

Run in `packages/theme/`: `vp test`
Expected: PASS — including the exact-string mode emission test.

- [ ] **Step 5: Commit**

```bash
git add src/theme.ts src/theme.test.ts
git commit -m "Add prefers-color-scheme mode compilation to createTheme"
```

---

### Task 7: `Theme` component

**Files:**
- Modify: `packages/theme/src/theme.ts` (real `ThemeComponent` type + component factory)
- Test: `packages/theme/src/theme.test.ts` (append)

**Interfaces:**
- Consumes: `createElement`, `Handle`, `RemixElement` from `remix/ui`; `renderToString` from `remix/ui/server` (test only); Task 6's `compile()`.
- Produces: `type ThemeProps = { nonce?: string }`; `type ThemeComponent = (handle: Handle<ThemeProps>) => () => RemixElement`; `createTheme(...).Theme` renders `<style data-pitlane-theme>` with escaped CSS text.

- [ ] **Step 1: Write the failing tests**

Append to `packages/theme/src/theme.test.ts`:

```ts
import { createElement } from "remix/ui";
import { renderToString } from "remix/ui/server";

describe("Theme component", () => {
    it("renders a style tag with the theme CSS", async () => {
        let { Theme } = createTheme(config, {
            modes: { dark: { color: { bg: { $value: "{color.gray.900}" } } } },
        });
        let html = await renderToString(createElement(Theme, {}));
        expect(html).toContain("<style");
        expect(html).toContain("data-pitlane-theme");
        expect(html).toContain("--color-white: #fff;");
        expect(html).toContain("@media (prefers-color-scheme: dark)");
        expect(html).toContain("--color-bg: var(--color-gray-900);");
    });

    it("passes the nonce through", async () => {
        let { Theme } = createTheme(config);
        let html = await renderToString(createElement(Theme, { nonce: "abc123" }));
        expect(html).toContain('nonce="abc123"');
    });

    it("escapes </style in token values", async () => {
        let { Theme } = createTheme({
            font: { $type: "fontFamily", evil: { $value: "</style><script>" } },
        });
        let html = await renderToString(createElement(Theme, {}));
        expect(html).not.toContain("</style><script>");
        expect(html).toContain("<\\/style>");
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run in `packages/theme/`: `vp test`
Expected: FAIL — `Theme` currently returns `null`; assertions on style content fail.

- [ ] **Step 3: Implement the component**

In `packages/theme/src/theme.ts`:

1. Add imports:

```ts
import { createElement } from "remix/ui";
import type { Handle, RemixElement } from "remix/ui";
```

2. Replace the placeholder `ThemeComponent` type and add the factory:

```ts
export type ThemeProps = {
    nonce?: string;
};

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
```

3. In `createTheme`, replace `Theme: () => null` with `Theme: createThemeComponent(compiled.cssText)`.

- [ ] **Step 4: Run tests to verify they pass**

Run in `packages/theme/`: `vp test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/theme.ts src/theme.test.ts
git commit -m "Render theme tokens through a Theme style component"
```

---

### Task 8: `ThemedCSSProps` + module-level `css()`

**Files:**
- Create: `packages/theme/src/props.ts`
- Create: `packages/theme/src/css.ts`
- Test: `packages/theme/src/css.test.ts`
- Test: `packages/theme/src/props.test-d.ts`

**Interfaces:**
- Consumes: brand types from `./brands.ts`; `css as remixCss`, `CSSMixinDescriptor` from `remix/ui`.
- Produces (used by Tasks 9–12): `type ThemedCSSProps` (the canonical property map from the spec §ThemedCSSProps — copy the accepted-values table exactly); `css(styles: ThemedCSSProps): CSSMixinDescriptor`.

- [ ] **Step 1: Write the failing runtime test**

Create `packages/theme/src/css.test.ts`:

```ts
import { createElement } from "remix/ui";
import { renderToString } from "remix/ui/server";
import { describe, expect, it } from "vitest";

import { css } from "./css.ts";
import { createTheme } from "./theme.ts";

const { token: $ } = createTheme({
    color: { $type: "color", white: { $value: "#fff" } },
    space: { $type: "dimension", sm: { $value: "8px" }, md: { $value: "16px" } },
});

describe("css", () => {
    it("renders token refs, tuple joins, and nesting through remix/ui css()", async () => {
        let html = await renderToString(
            createElement("div", {
                mix: css({
                    color: $.color.white,
                    padding: [$.space.sm, $.space.md],
                    margin: 0,
                    "&:hover": { color: $.color.white },
                }),
            }),
        );
        expect(html).toContain("color: var(--color-white)");
        expect(html).toContain("padding: var(--space-sm) var(--space-md)");
        expect(html).toContain("margin: 0");
        expect(html).toContain(":hover");
        // The mixin generated a class and attached it to the element
        expect(html).toMatch(/<div class="/);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run in `packages/theme/`: `vp test`
Expected: FAIL — cannot find module `./css.ts`.

- [ ] **Step 3: Implement `props.ts`**

Create `packages/theme/src/props.ts` — this is the spec's canonical property map, verbatim:

```ts
import type {
    ColorToken,
    CubicBezierToken,
    DimensionToken,
    DurationToken,
    FontFamilyToken,
    FontWeightToken,
    NumberToken,
    ShadowToken,
} from "./brands.ts";

type Wide = "inherit" | "initial" | "unset" | "revert" | "revert-layer";

type ColorLike = ColorToken | "transparent" | "currentColor" | Wide;
type Size = DimensionToken | 0 | Wide;
type SizeAuto = DimensionToken | 0 | "auto" | Wide;
type SizeIntrinsic =
    | DimensionToken
    | 0
    | "auto"
    | "min-content"
    | "max-content"
    | "fit-content"
    | Wide;
type SpacingText = DimensionToken | 0 | "normal" | Wide;
type LineWidth = DimensionToken | 0 | "thin" | "medium" | "thick" | Wide;
type Easing =
    | CubicBezierToken
    | "ease"
    | "linear"
    | "ease-in"
    | "ease-out"
    | "ease-in-out"
    | "step-start"
    | "step-end"
    | Wide;
type ShadowLike = ShadowToken | "none" | Wide;
type Numeric = NumberToken | number | Wide;

type Repeat1to4<V> =
    | readonly [V]
    | readonly [V, V]
    | readonly [V, V, V]
    | readonly [V, V, V, V];

type PadItem = DimensionToken | 0;
type MarginItem = DimensionToken | 0 | "auto";

export interface ThemedCSSProps {
    // Colors
    color?: ColorLike;
    backgroundColor?: ColorLike;
    borderColor?: ColorLike;
    borderTopColor?: ColorLike;
    borderRightColor?: ColorLike;
    borderBottomColor?: ColorLike;
    borderLeftColor?: ColorLike;
    outlineColor?: ColorLike;
    textDecorationColor?: ColorLike;
    columnRuleColor?: ColorLike;
    caretColor?: ColorLike;
    accentColor?: ColorLike;
    fill?: ColorLike;
    stroke?: ColorLike;
    // Sizing
    width?: SizeIntrinsic;
    height?: SizeIntrinsic;
    minWidth?: SizeIntrinsic;
    minHeight?: SizeIntrinsic;
    maxWidth?: SizeIntrinsic;
    maxHeight?: SizeIntrinsic;
    flexBasis?: SizeIntrinsic;
    // Position offsets & margins
    top?: SizeAuto;
    right?: SizeAuto;
    bottom?: SizeAuto;
    left?: SizeAuto;
    marginTop?: SizeAuto;
    marginRight?: SizeAuto;
    marginBottom?: SizeAuto;
    marginLeft?: SizeAuto;
    // Paddings & other plain sizes
    paddingTop?: Size;
    paddingRight?: Size;
    paddingBottom?: Size;
    paddingLeft?: Size;
    fontSize?: Size;
    textIndent?: Size;
    outlineOffset?: Size;
    borderTopLeftRadius?: Size;
    borderTopRightRadius?: Size;
    borderBottomRightRadius?: Size;
    borderBottomLeftRadius?: Size;
    rowGap?: Size;
    columnGap?: Size;
    // Text spacing
    letterSpacing?: SpacingText;
    wordSpacing?: SpacingText;
    // Border widths
    borderTopWidth?: LineWidth;
    borderRightWidth?: LineWidth;
    borderBottomWidth?: LineWidth;
    borderLeftWidth?: LineWidth;
    outlineWidth?: LineWidth;
    // Box shorthands (single value or 1–4 tuple)
    padding?: Size | Repeat1to4<PadItem>;
    margin?: SizeAuto | Repeat1to4<MarginItem>;
    inset?: SizeAuto | Repeat1to4<MarginItem>;
    borderRadius?: Size | Repeat1to4<PadItem>;
    gap?: Size | readonly [PadItem, PadItem];
    // Typography
    fontFamily?: FontFamilyToken | Wide;
    fontWeight?: FontWeightToken | "normal" | "bold" | "lighter" | "bolder" | Wide;
    lineHeight?: NumberToken | DimensionToken | "normal" | Wide;
    // Numbers
    opacity?: Numeric;
    zIndex?: Numeric;
    flexGrow?: Numeric;
    flexShrink?: Numeric;
    order?: Numeric;
    // Motion
    transitionDuration?: DurationToken | Wide;
    transitionDelay?: DurationToken | Wide;
    animationDuration?: DurationToken | Wide;
    animationDelay?: DurationToken | Wide;
    transitionTimingFunction?: Easing;
    animationTimingFunction?: Easing;
    // Shadows
    boxShadow?: ShadowLike;
    textShadow?: ShadowLike;
    // Everything else stays loose; nested selectors/media recurse.
    [key: string]:
        | ThemedCSSProps
        | string
        | number
        | null
        | undefined
        | readonly (string | number)[];
}
```

- [ ] **Step 4: Implement `css.ts`**

Create `packages/theme/src/css.ts`:

```ts
import { css as remixCss } from "remix/ui";
import type { CSSMixinDescriptor } from "remix/ui";

import type { ThemedCSSProps } from "./props.ts";

type RemixCSSProps = Parameters<typeof remixCss>[0];

/**
 * Brand-typed wrapper over remix/ui's css() mixin. Branded token refs are
 * already `var()` strings; tuples join with spaces; everything else passes
 * straight through.
 */
export function css(styles: ThemedCSSProps): CSSMixinDescriptor {
    return remixCss(normalizeStyles(styles) as RemixCSSProps);
}

function normalizeStyles(styles: ThemedCSSProps): Record<string, unknown> {
    let out: Record<string, unknown> = {};
    for (let [key, value] of Object.entries(styles)) {
        if (Array.isArray(value)) {
            out[key] = value.join(" ");
        } else if (typeof value === "object" && value !== null) {
            out[key] = normalizeStyles(value as ThemedCSSProps);
        } else {
            out[key] = value;
        }
    }
    return out;
}
```

- [ ] **Step 5: Run the runtime test to verify it passes**

Run in `packages/theme/`: `vp test`
Expected: PASS.

- [ ] **Step 6: Write the brand-enforcement type tests**

Create `packages/theme/src/props.test-d.ts`:

```ts
import { describe, expectTypeOf, it } from "vitest";

import { createTheme } from "./theme.ts";
import type { ThemedCSSProps } from "./props.ts";

const { token: $ } = createTheme({
    color: { $type: "color", white: { $value: "#fff" } },
    space: { $type: "dimension", md: { $value: "16px" } },
    weight: { $type: "fontWeight", bold: { $value: 700 } },
    shadow: {
        card: {
            $type: "shadow",
            $value: { color: "#000", offsetX: "0px", offsetY: "1px" },
        },
    },
    motion: { $type: "duration", fast: { $value: "150ms" } },
} as const);

describe("ThemedCSSProps enforcement", () => {
    it("accepts branded tokens, keywords, zero, and tuples", () => {
        expectTypeOf({
            color: $.color.white,
            backgroundColor: "transparent" as const,
            fontSize: $.space.md,
            fontWeight: $.weight.bold,
            boxShadow: $.shadow.card,
            transitionDuration: $.motion.fast,
            margin: 0 as const,
            padding: [$.space.md, 0] as const,
            gap: [$.space.md, $.space.md] as const,
            width: "min-content" as const,
            opacity: 0.5,
            display: "flex",
        }).toMatchTypeOf<ThemedCSSProps>();
    });

    it("rejects off-palette and wrong-brand values", () => {
        // @ts-expect-error — off-palette color literal
        let offPalette: ThemedCSSProps = { color: "#ff0000" };
        // @ts-expect-error — dimension token is not a color
        let wrongBrand: ThemedCSSProps = { color: $.space.md };
        // @ts-expect-error — color token is not a dimension
        let wrongBrand2: ThemedCSSProps = { fontSize: $.color.white };
        // @ts-expect-error — arbitrary string is not a shadow
        let looseShadow: ThemedCSSProps = { boxShadow: "0 0 3px red" };
        // @ts-expect-error — durations reject bare numbers
        let bareDuration: ThemedCSSProps = { transitionDuration: 200 };
        void offPalette;
        void wrongBrand;
        void wrongBrand2;
        void looseShadow;
        void bareDuration;
    });

    it("keeps unmapped properties loose", () => {
        expectTypeOf({
            border: `1px solid ${$.color.white}`,
            background: "canvas",
            "&:hover": { color: $.color.white },
        }).toMatchTypeOf<ThemedCSSProps>();
    });
});
```

- [ ] **Step 7: Run tests to verify everything passes**

Run in `packages/theme/`: `vp test`
Expected: PASS — runtime and typecheck suites, including the `@ts-expect-error` assertions.

- [ ] **Step 8: Commit**

```bash
git add src/props.ts src/css.ts src/css.test.ts src/props.test-d.ts
git commit -m "Add brand-enforced ThemedCSSProps and css() wrapper"
```

---

### Task 9: `tva` — Theme Variance Authority

**Files:**
- Create: `packages/theme/src/tva.ts` (`tva`, `deepMerge`; `combine`/`cx` follow in Task 10)
- Test: `packages/theme/src/tva.test.ts`
- Test: `packages/theme/src/tva.test-d.ts`

**Interfaces:**
- Consumes: `css` from `./css.ts`; `ThemedCSSProps` from `./props.ts`; `CSSMixinDescriptor` from `remix/ui`.
- Produces (Task 10 extends this file; Tasks 11–12 consume):
  - `interface TVAFn<V> { (props?: Selection<V>): CSSMixinDescriptor; resolve(props?: Selection<V>): ThemedCSSProps }`
  - `tva<const V extends VariantShape>(config: TVAConfig<V>): TVAFn<V>`
  - `type TVAProps<F>` — extracts the props object type
  - `deepMerge(a, b)` — objects merge recursively; arrays and primitives replace

- [ ] **Step 1: Write the failing tests**

Create `packages/theme/src/tva.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { tva } from "./tva.ts";
import type { ThemedCSSProps } from "./props.ts";

let button = tva({
    base: { margin: 0, "&:hover": { opacity: 0.9 } },
    variants: {
        intent: {
            primary: { color: "currentColor", "&:hover": { opacity: 1 } },
            danger: { color: "transparent" },
        },
        block: {
            true: { width: "auto" },
            false: {},
        },
    },
    compoundVariants: [{ intent: "danger", block: true, css: { opacity: 0.5 } }],
    defaultVariants: { intent: "primary", block: false },
});

describe("tva", () => {
    it("resolves defaults", () => {
        expect(button.resolve()).toEqual({
            margin: 0,
            color: "currentColor",
            "&:hover": { opacity: 1 },
        });
    });

    it("resolves explicit variants and boolean keys", () => {
        expect(button.resolve({ intent: "danger", block: true })).toEqual({
            margin: 0,
            color: "transparent",
            width: "auto",
            "&:hover": { opacity: 0.9 },
            opacity: 0.5,
        });
    });

    it("ignores explicitly-undefined props in favor of defaults", () => {
        expect(button.resolve({ intent: undefined })).toMatchObject({ color: "currentColor" });
    });

    it("deep-merges nested selector objects rather than replacing the whole base", () => {
        let styles = button.resolve({ intent: "primary" });
        expect(styles["&:hover"]).toEqual({ opacity: 1 });
    });

    it("applies compound variants only when every key matches", () => {
        expect(button.resolve({ intent: "danger", block: false })).not.toMatchObject({
            opacity: 0.5,
        });
    });

    it("merges compound variants after variants (last write wins)", () => {
        let chip = tva({
            variants: { tone: { loud: { opacity: 0.9 } } },
            compoundVariants: [{ tone: "loud", css: { opacity: 0.4 } }],
        });
        expect(chip.resolve({ tone: "loud" })).toEqual({ opacity: 0.4 });
    });

    it("returns a mixin descriptor from the callable", () => {
        let descriptor = button({ intent: "danger" });
        expect(descriptor).toBeTruthy();
        expect(typeof descriptor).toBe("object");
    });

    it("works without base or variants", () => {
        let bare = tva({});
        expect(bare.resolve()).toEqual({});
    });
});

// Type-level guard that resolve() returns ThemedCSSProps
let _styles: ThemedCSSProps = button.resolve();
void _styles;
```

Create `packages/theme/src/tva.test-d.ts`:

```ts
import { describe, expectTypeOf, it } from "vitest";

import { tva } from "./tva.ts";
import type { TVAProps } from "./tva.ts";

let button = tva({
    variants: {
        intent: { primary: {}, danger: {} },
        block: { true: {}, false: {} },
    },
});

describe("TVAProps", () => {
    it("maps variant keys to unions and booleans", () => {
        expectTypeOf<TVAProps<typeof button>>().toEqualTypeOf<{
            intent?: "primary" | "danger";
            block?: boolean;
        }>();
    });

    it("rejects unknown variant values", () => {
        // @ts-expect-error — "ghost" is not a declared intent
        button({ intent: "ghost" });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run in `packages/theme/`: `vp test`
Expected: FAIL — cannot find module `./tva.ts`.

- [ ] **Step 3: Implement `tva.ts`**

Create `packages/theme/src/tva.ts`:

```ts
import { css } from "./css.ts";
import type { CSSMixinDescriptor } from "remix/ui";
import type { ThemedCSSProps } from "./props.ts";

type VariantShape = Record<string, Record<string, ThemedCSSProps>>;

type VariantValue<K> = K extends "true" | "false" ? boolean : K;

type Selection<V extends VariantShape> = {
    -readonly [K in keyof V]?: VariantValue<keyof V[K] & string>;
};

export interface TVAConfig<V extends VariantShape> {
    base?: ThemedCSSProps;
    variants?: V;
    compoundVariants?: readonly (Selection<V> & { css: ThemedCSSProps })[];
    defaultVariants?: Selection<V>;
}

export interface TVAFn<V extends VariantShape> {
    (props?: Selection<V>): CSSMixinDescriptor;
    resolve(props?: Selection<V>): ThemedCSSProps;
}

export type TVAProps<F> = F extends TVAFn<infer V> ? Selection<V> : never;

export function tva<const V extends VariantShape>(config: TVAConfig<V>): TVAFn<V> {
    function resolve(props?: Selection<V>): ThemedCSSProps {
        let selected: Record<string, unknown> = { ...config.defaultVariants };
        for (let [key, value] of Object.entries(props ?? {})) {
            if (value !== undefined) selected[key] = value;
        }

        let merged: Record<string, unknown> = { ...(config.base ?? {}) };
        for (let [name, values] of Object.entries(config.variants ?? {})) {
            let choice = selected[name];
            if (choice === undefined || choice === null) continue;
            let styles = (values as Record<string, ThemedCSSProps>)[String(choice)];
            if (styles) merged = deepMerge(merged, styles) as Record<string, unknown>;
        }
        for (let compound of config.compoundVariants ?? []) {
            let { css: compoundCss, ...match } = compound;
            let matches = Object.entries(match).every(([key, value]) => selected[key] === value);
            if (matches) merged = deepMerge(merged, compoundCss) as Record<string, unknown>;
        }
        return merged as ThemedCSSProps;
    }

    let fn = (props?: Selection<V>) => css(resolve(props));
    return Object.assign(fn, { resolve });
}

/** Plain objects merge recursively; arrays and primitives replace. */
export function deepMerge(a: unknown, b: unknown): unknown {
    if (!isPlainObject(a) || !isPlainObject(b)) return b;
    let out: Record<string, unknown> = { ...a };
    for (let [key, value] of Object.entries(b)) {
        out[key] = key in out ? deepMerge(out[key], value) : value;
    }
    return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run in `packages/theme/`: `vp test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tva.ts src/tva.test.ts src/tva.test-d.ts
git commit -m "Add tva variant resolver"
```

---

### Task 10: `combine` and `cx`

**Files:**
- Modify: `packages/theme/src/tva.ts` (append `combine`, `cx`, `ClassValue`)
- Test: `packages/theme/src/tva.test.ts` (append)
- Test: `packages/theme/src/tva.test-d.ts` (append)

**Interfaces:**
- Consumes: Task 9's `TVAFn`, `deepMerge`, `css`.
- Produces: `combine(...fns: TVAFn[]): TVAFn`-alike whose props are the intersection of the inputs' props; `cx(...values: ClassValue[]): string`; `type ClassValue`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/theme/src/tva.test.ts`:

```ts
import { combine, cx, tva as tvaFactory } from "./tva.ts";

describe("combine", () => {
    let sizing = tvaFactory({
        variants: { size: { sm: { fontSize: 0 }, lg: { opacity: 1 } } },
        defaultVariants: { size: "sm" },
    });
    let toned = tvaFactory({
        base: { margin: 0 },
        variants: { tone: { loud: { opacity: 0.9 } } },
    });

    it("merges resolved styles in argument order", () => {
        let both = combine(sizing, toned);
        expect(both.resolve({ size: "lg", tone: "loud" })).toEqual({
            opacity: 0.9,
            margin: 0,
        });
    });

    it("honors each component's defaults", () => {
        let both = combine(sizing, toned);
        expect(both.resolve()).toEqual({ fontSize: 0, margin: 0 });
    });

    it("returns a mixin descriptor from the callable", () => {
        let both = combine(sizing, toned);
        expect(typeof both({ tone: "loud" })).toBe("object");
    });
});

describe("cx", () => {
    it("joins truthy class values like clsx", () => {
        expect(cx("a", false, null, undefined, 0, "b", ["c", ["d"]], { e: true, f: false })).toBe(
            "a b c d e",
        );
    });

    it("returns an empty string for no input", () => {
        expect(cx()).toBe("");
    });
});
```

Append to `packages/theme/src/tva.test-d.ts`:

```ts
import { combine } from "./tva.ts";

describe("combine props", () => {
    it("accepts the union of variant props and rejects unknown values", () => {
        let sizing = tva({ variants: { size: { sm: {}, lg: {} } } });
        let toned = tva({ variants: { tone: { loud: {}, quiet: {} } } });
        let both = combine(sizing, toned);
        both({ size: "lg", tone: "quiet" });
        both();
        // @ts-expect-error — "xl" is not a declared size
        both({ size: "xl" });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run in `packages/theme/`: `vp test`
Expected: FAIL — `combine` and `cx` are not exported.

- [ ] **Step 3: Implement `combine` and `cx`**

Append to `packages/theme/src/tva.ts`:

```ts
type UnionToIntersection<U> = (U extends unknown ? (arg: U) => void : never) extends (
    arg: infer I,
) => void
    ? I
    : never;

type CombinedProps<Fns extends readonly TVAFn<VariantShape>[]> = UnionToIntersection<
    // Exclude the optional-parameter undefined per union member — it would
    // otherwise poison the intersection into an uninhabited type.
    Exclude<Parameters<Fns[number]>[0], undefined>
> extends infer P
    ? { [K in keyof P]: P[K] }
    : never;

export interface CombinedTVAFn<Fns extends readonly TVAFn<VariantShape>[]> {
    (props?: CombinedProps<Fns>): CSSMixinDescriptor;
    resolve(props?: CombinedProps<Fns>): ThemedCSSProps;
}

/** cva-`compose` analog: one css() call over every input's resolved styles. */
export function combine<Fns extends readonly TVAFn<VariantShape>[]>(
    ...fns: Fns
): CombinedTVAFn<Fns> {
    function resolve(props?: CombinedProps<Fns>): ThemedCSSProps {
        let merged: unknown = {};
        for (let fn of fns) {
            merged = deepMerge(merged, fn.resolve(props as never));
        }
        return merged as ThemedCSSProps;
    }
    let fn = (props?: CombinedProps<Fns>) => css(resolve(props));
    return Object.assign(fn, { resolve });
}

export type ClassValue =
    | string
    | number
    | null
    | undefined
    | false
    | readonly ClassValue[]
    | Record<string, boolean | null | undefined>;

/** clsx-compatible className joiner for the className interop escape hatch. */
export function cx(...inputs: ClassValue[]): string {
    let out: string[] = [];
    for (let input of inputs) {
        if (!input) continue;
        if (typeof input === "string" || typeof input === "number") {
            out.push(String(input));
        } else if (Array.isArray(input)) {
            let inner = cx(...input);
            if (inner) out.push(inner);
        } else if (typeof input === "object") {
            for (let [key, on] of Object.entries(input)) {
                if (on) out.push(key);
            }
        }
    }
    return out.join(" ");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run in `packages/theme/`: `vp test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tva.ts src/tva.test.ts src/tva.test-d.ts
git commit -m "Add combine and cx helpers"
```

---

### Task 11: Public API surface (`index.ts`) + build verification

**Files:**
- Modify: `packages/theme/src/index.ts` (replace placeholder)
- Modify: `packages/theme/src/index.test.ts` (replace scaffold test)

**Interfaces:**
- Consumes: every prior task's exports.
- Produces: the published import surface of `@pitlane/theme` — exactly: `createTheme`, `css`, `tva`, `combine`, `cx`, `ThemeError`, and the public types.

- [ ] **Step 1: Write the failing surface test**

Replace `packages/theme/src/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import * as theme from "./index.ts";

describe("public surface", () => {
    it("exports exactly the public API", () => {
        expect(Object.keys(theme).sort()).toEqual([
            "ThemeError",
            "combine",
            "createTheme",
            "css",
            "cx",
            "tva",
        ]);
    });

    it("wires the pieces together end to end", () => {
        let { token, raw, Theme } = theme.createTheme({
            color: { $type: "color", white: { $value: "#fff" } },
        });
        expect(token.color.white).toBe("var(--color-white)");
        expect(raw(token.color.white)).toBe("#fff");
        expect(typeof Theme).toBe("function");
        expect(typeof theme.css({ color: token.color.white })).toBe("object");
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run in `packages/theme/`: `vp test`
Expected: FAIL — `index.ts` still exports only `VERSION`.

- [ ] **Step 3: Implement the public surface**

Replace `packages/theme/src/index.ts`:

```ts
export { createTheme } from "./theme.ts";
export type { ThemeComponent, ThemeOptions, ThemeProps, ThemeResult } from "./theme.ts";
export { css } from "./css.ts";
export { combine, cx, tva } from "./tva.ts";
export type { ClassValue, CombinedTVAFn, TVAConfig, TVAFn, TVAProps } from "./tva.ts";
export { ThemeError } from "./tokens.ts";
export type { ThemedCSSProps } from "./props.ts";
export type {
    AnyToken,
    BorderToken,
    ColorToken,
    CubicBezierToken,
    DimensionToken,
    DurationToken,
    FontFamilyToken,
    FontWeightToken,
    GradientToken,
    NumberToken,
    ShadowToken,
    StrokeStyleToken,
    TokenType,
    TransitionToken,
} from "./brands.ts";
export type { DeepPartialTokens, DTCGDocument, TokenTree } from "./types.ts";
```

- [ ] **Step 4: Run tests, then build**

Run in `packages/theme/`: `vp test`
Expected: PASS.

Run in `packages/theme/`: `vp run build`
Expected: succeeds; `dist/index.mjs` and `dist/index.d.mts` exist. Verify:

```bash
ls dist
node -e "import('./dist/index.mjs').then(m => console.log(Object.keys(m).sort().join(',')))"
```

Expected output includes: `ThemeError,combine,createTheme,css,cx,tva`.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/index.test.ts
git commit -m "Export the @pitlane/theme public API"
```

---

### Task 12: Documentation — package reference + styling guide

**Files:**
- Create: `docs/package/theme.md`
- Create: `docs/guides/styling.md`

**Interfaces:**
- Consumes: the final public API from Task 11 (names must match `index.ts` exactly).
- Produces: the two pages already linked from the VitePress sidebar (`/package/theme`, `/guides/styling`) — no `docs/.vitepress/config.ts` change needed.

- [ ] **Step 1: Write the package reference**

Create `docs/package/theme.md`. Content requirements (all sections REQUIRED; keep prose tight, follow the front-matter + `#`/`##` conventions of `docs/guides/getting-started.md`):

````markdown
---
title: "@pitlane/theme"
description: Type-safe styling with W3C design tokens for Remix 3.
---

# @pitlane/theme

Type-safe styling with design tokens. `createTheme` takes a [W3C DTCG design-token document](https://www.designtokens.org/tr/drafts/format/) and returns a branded token accessor plus a `<Theme />` component that installs the tokens as CSS custom properties. Module-level `css`, `tva`, `cx`, and `combine` helpers enforce your palette at the type level on top of `remix/ui`'s `css()` mixin.

## Install

```bash
vp add @pitlane/theme
```

`remix` (>= 3.0.0-beta.5) is a peer dependency.

## createTheme

```ts
import { createTheme } from "@pitlane/theme";

export let { token: $, raw, Theme } = createTheme(
    {
        color: {
            $type: "color",
            white: { $value: "#fff" },
            gray: { 50: { $value: "#fafafa" }, 900: { $value: "#171717" } },
            bg: { $value: "{color.white}" },
        },
        space: {
            $type: "dimension",
            sm: { $value: "8px" },
            md: { $value: { value: 16, unit: "px" } },
        },
    },
    {
        modes: {
            dark: { color: { bg: { $value: "{color.gray.900}" } } },
        },
    },
);
```

- `token` — a same-shape accessor. Every leaf is a `var(--…)` string branded by its token type: `$.color.white` is a `ColorToken` whose value is `"var(--color-white)"`.
- `raw(ref)` — the serialized base-mode value behind a ref: `raw($.color.white)` → `"#fff"`. Aliases are chased to their concrete value. Refs from another theme throw.
- `Theme` — a component that renders a `<style data-pitlane-theme>` tag containing the token CSS. Render it once near your root. Accepts an optional `nonce` prop for CSP.

CSS variable names are the kebab-cased token path: `color.gray.900` → `--color-gray-900`.

Author token documents in TypeScript. JSON imports work at runtime, but TypeScript widens JSON literals, so brands degrade to `never` — a `.ts` file with an inline object (no `as const` needed) gives full typing.

### Modes

`modes.light` / `modes.dark` are partial documents of the same shape that override `$value` only. They emit under `@media (prefers-color-scheme: …)` — no attribute selectors. Aliased overrides keep their `var()` indirection, so a mode override of a referenced token cascades through every alias.

## DTCG support

| Feature | Support |
| --- | --- |
| Groups + group-level `$type` inheritance | ✓ |
| Aliases `{path.to.token}` (full values and composite sub-values) | ✓ — emitted as `var()` references |
| color, dimension, duration | ✓ — legacy strings and structured objects |
| fontFamily, fontWeight, number, cubicBezier | ✓ |
| shadow, border, transition, gradient, strokeStyle | ✓ — single CSS value each |
| typography | ✗ — throws (planned) |
| `$description`, `$extensions`, `$deprecated` | Parsed and ignored |

Gradient tokens serialize to a color-stop list (`#fff 0%, #000 100%`) for use inside `linear-gradient(…)` and friends. Gradient stop positions must be literal numbers; stop colors may be aliases. Object-form `strokeStyle` serializes to `dashed` (the spec's CSS fallback).

## css

```ts
import { css } from "@pitlane/theme";
import { $ } from "./theme.ts";

let card = css({
    color: $.color.bg, // ✓ ColorToken
    backgroundColor: "transparent", // ✓ CSS keyword
    padding: [$.space.sm, $.space.md], // ✓ 1–4 token tuple
    margin: 0, // ✓ literal zero
    "&:hover": { color: $.color.gray[900] },
});

<div mix={card} />;
```

Token-mapped longhands only accept the matching brand, CSS-wide keywords, property keywords, and `0` — `color: "#ff0000"` is a type error. Unmapped properties (`display`, `border`, `background`, …) stay loosely typed; interpolating a token into a template string (`` border: `1px solid ${$.color.bg}` ``) is the intended escape hatch, and `remix/ui`'s own `css()` remains fully untyped if you need out.

[Document the full property map table here — copy the “Canonical property map” table from the design spec verbatim.]

## tva

```ts
import { tva } from "@pitlane/theme";
import type { TVAProps } from "@pitlane/theme";

let button = tva({
    base: { padding: [$.space.sm, $.space.md] },
    variants: {
        intent: {
            primary: { backgroundColor: $.color.gray[900], color: $.color.white },
            neutral: { backgroundColor: $.color.white, color: $.color.gray[900] },
        },
        block: { true: { width: "auto" } },
    },
    compoundVariants: [{ intent: "neutral", block: true, css: { margin: 0 } }],
    defaultVariants: { intent: "primary" },
});

type ButtonProps = TVAProps<typeof button>;

<button mix={button({ intent: "neutral" })} />;
```

Styles deep-merge `base` → matching variants → matching compound variants into one `css()` call. `combine(a, b)` composes tva components (cva's `compose`); `cx(…)` is a clsx-style `className` joiner for interop.

## Errors

`createTheme` throws `ThemeError` (never renders broken CSS) for: missing or unknown `$type`; typography tokens; aliases to unknown tokens; alias cycles; CSS variable-name collisions; invalid values for a declared type; and mode overrides that target unknown tokens or set anything but `$value`. `raw()` throws for refs the theme didn't mint.
````

Replace the bracketed placeholder line with the actual “Canonical property map” table copied from `docs/superpowers/specs/2026-07-08-pitlane-theme-design.md` §ThemedCSSProps — verbatim, including the `Wide` legend sentence.

- [ ] **Step 2: Write the styling guide**

Create `docs/guides/styling.md` — narrative structure (all sections REQUIRED):

````markdown
---
title: Styling
description: Style Remix apps with remix/ui css mixins and @pitlane/theme design tokens.
---

# Styling

Remix UI styles elements with the `css()` mixin through the `mix` prop — no class-name management, SSR-streamed style tags, automatic deduplication:

```tsx
import { css } from "remix/ui";

function Card() {
    return () => <article mix={css({ padding: "16px", color: "#111" })}>…</article>;
}
```

That works, but every value is a loose string. `@pitlane/theme` layers design tokens and type safety on top.

## Define a theme

Design tokens live in a [W3C DTCG](https://www.designtokens.org/tr/drafts/format/) document passed to `createTheme`. Define the theme once in `app/theme.ts` and export the pieces:

```ts
import { createTheme } from "@pitlane/theme";

export let { token: $, raw, Theme } = createTheme(
    {
        color: {
            $type: "color",
            white: { $value: "#fff" },
            gray: { 50: { $value: "#fafafa" }, 900: { $value: "#171717" } },
            bg: { $value: "{color.white}" },
        },
        space: { $type: "dimension", sm: { $value: "8px" }, md: { $value: "16px" } },
    },
    {
        modes: {
            dark: { color: { bg: { $value: "{color.gray.900}" } } },
        },
    },
);
```

`$.color.white` is a `ColorToken` — a typed `var(--color-white)` reference. `raw($.color.white)` returns `"#fff"`.

## Install the tokens

Render `<Theme />` once near the root; it emits a `<style>` tag with your CSS custom properties, streaming-safe on the server:

```tsx
import { Theme } from "./theme.ts";

function App() {
    return () => (
        <html>
            <head>
                <Theme />
            </head>
            <body>…</body>
        </html>
    );
}
```

## Use tokens in styles

`css` from `@pitlane/theme` is remix/ui's `css()` with brand enforcement — token-mapped properties only accept tokens from your theme:

```ts
import { css } from "@pitlane/theme";
import { $ } from "./theme.ts";

let card = css({
    color: $.color.bg,
    padding: [$.space.sm, $.space.md], // 1–4 value tuples join with spaces
    margin: 0,
    // color: "#ff0000", // ✗ type error — not in the palette
    "&:hover": { color: $.color.gray[900] },
});
```

Unmapped properties stay loose, and template interpolation is the escape hatch for shorthands: `` border: `1px solid ${$.color.gray[900]}` ``.

## Dark mode

Modes are partial token documents overriding `$value` only, emitted under `@media (prefers-color-scheme: …)`:

```css
:root {
    --color-bg: var(--color-white);
}

@media (prefers-color-scheme: dark) {
    :root {
        --color-bg: var(--color-gray-900);
    }
}
```

Aliases keep their `var()` indirection in the emitted CSS, so overriding one referenced token in `modes.dark` flips every alias that points at it — no duplicate declarations, no JavaScript.

## Variants with tva

`tva` is a cva-style variant resolver that returns a `mix`-ready descriptor:

```ts
import { tva } from "@pitlane/theme";
import type { TVAProps } from "@pitlane/theme";
import { $ } from "./theme.ts";

export let button = tva({
    base: { padding: [$.space.sm, $.space.md] },
    variants: {
        intent: {
            primary: { backgroundColor: $.color.gray[900], color: $.color.white },
            neutral: { backgroundColor: $.color.white, color: $.color.gray[900] },
        },
    },
    defaultVariants: { intent: "primary" },
});

export type ButtonProps = TVAProps<typeof button>;
```

## A complete component

```tsx
import { Theme } from "./theme.ts";
import { button } from "./button.ts";
import type { ButtonProps } from "./button.ts";
import type { Handle } from "remix/ui";

function SaveButton(handle: Handle<{ intent?: ButtonProps["intent"] }>) {
    return () => <button mix={button({ intent: handle.props.intent })}>Save</button>;
}

function App() {
    return () => (
        <html>
            <head>
                <Theme />
            </head>
            <body>
                <SaveButton intent="neutral" />
            </body>
        </html>
    );
}
```
````

All examples import from `@pitlane/theme` (the `pitlane/theme` umbrella subpath does not exist yet). The token document must stay consistent with the one in `/package/theme.md`.

- [ ] **Step 3: Verify the docs build**

Run at the repo root: `vp run docs:build`
Expected: VitePress build succeeds; no dead-link errors for `/package/theme` or `/guides/styling` (both are already in the sidebar).

- [ ] **Step 4: Commit**

```bash
git add docs/package/theme.md docs/guides/styling.md
git commit -m "Add @pitlane/theme reference and styling guide"
```

---

### Task 13: Publish workflow + final verification

**Files:**
- Create: `.github/workflows/publish.yml`

**Interfaces:**
- Consumes: the finished package.
- Produces: release-triggered npm publishing with provenance, gated on the `@pitlane/theme@` tag prefix.

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
    release:
        types: [published]

permissions:
    contents: read
    id-token: write

jobs:
    publish-theme:
        if: startsWith(github.event.release.tag_name, '@pitlane/theme@')
        runs-on: ubuntu-latest
        defaults:
            run:
                working-directory: packages/theme
        steps:
            - name: Checkout code
              uses: actions/checkout@v4

            - name: Setup Vite+
              uses: voidzero-dev/setup-vp@v1
              with:
                  node-version: "24"
                  cache: true

            - name: Install
              run: vp install --frozen-lockfile

            - name: Run tests
              run: vp test

            - name: Build package
              run: vp run build

            - name: Publish to npm with provenance
              run: npm publish --provenance --access public --tag latest
```

Future packages add their own `publish-<name>` job with their own tag-prefix filter.

- [ ] **Step 2: Repo-wide verification (the once-at-the-end pass)**

Run at the repo root, in order:

```bash
vp fmt
vp lint
```

Expected: fmt may rewrite files (stage them); lint passes. If lint flags rules in package code that conflict with generated patterns, fix the code — do not add rule exceptions.

Run in `packages/theme/`:

```bash
vp test
vp run build
```

Expected: full suite PASS; build succeeds.

Run at the repo root:

```bash
vp run docs:build
```

Expected: docs build PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add publish workflow for @pitlane/theme"
```

- [ ] **Step 4: Release checklist (manual, post-merge)**

1. Ensure the `pitlane` npm org exists and the publishing account/token has access (workflow uses OIDC provenance; the repo must be linked as a trusted publisher for `@pitlane/theme` on npm, or an `NODE_AUTH_TOKEN` step added).
2. Publish a GitHub release tagged `@pitlane/theme@0.1.0`.
3. Verify the `publish-theme` job runs and the package lands on npm with provenance.

---

## Plan self-review notes

- **Spec coverage**: API surface (Tasks 5–11), pipeline + error catalog (Tasks 3–6), brands/TokenTree/ThemedCSSProps (Tasks 2, 8), workspace/package/build (Task 1), publishing (Task 13), testing strategy (every task; type tests in 2, 8, 9, 10), docs (Task 12). `raw` foreign-ref error: Task 5. Typography rejection: Task 3 (runtime) + `never` leaf noted in Task 2.
- **Known intentional deviations**: none. Where the spec pins exact strings (var naming, mode emission format, error phrasing), tests assert them.
- **Verification chain**: every task ends in a scoped `vp test`; Task 11 verifies the built artifact; Task 12 verifies the docs build; Task 13 runs the repo-wide fmt/lint/test/build pass.
