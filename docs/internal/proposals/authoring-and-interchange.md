# Token authoring and DTCG interchange

Status: proposal, unscheduled. Supersedes parts of `theme-authoring.md`;
see "Reconciling the earlier proposal" at the end.

`@pitlane/theme` 0.1.0 uses one format for two jobs: a W3C DTCG document is
both what you author and what the compiler eats. This proposes splitting them.
Authoring becomes a TypeScript surface designed for CSS. DTCG becomes an
interchange format the package reads at one edge and writes at the other,
behind a build step.

The package has never been published (`npm view @pitlane/theme` returns a 404,
and `CHANGELOG.md` has a single unreleased 0.1.0 entry), so there is no
migration story to write. The only consumers are in this repo.

## Why the current arrangement does not hold

### DTCG 2025.10 cannot express a CSS design system

The format module reached [Final Community Group Report](https://www.designtokens.org/tr/2025.10/format/)
on 28 October 2025 and is marked stable. Read against that text, the value
grammar is narrower than CSS on every axis the package cares about:

| Type | DTCG 2025.10 requires | What that rules out |
| --- | --- | --- |
| `dimension` | object `{ value: number, unit: "px" \| "rem" }` | `em`, `ch`, `%`, `vh`, `clamp()`, `calc()`, `min()` |
| `duration` | object `{ value: number, unit: "ms" \| "s" }` | `calc()`, custom-property arithmetic |
| `color` | object `{ colorSpace, components, alpha?, hex? }` per the [Color module](https://www.designtokens.org/tr/2025.10/color/) | `light-dark()`, `color-mix()`, `currentColor`, any CSS color function |
| `shadow` | `color`, `offsetX`, `offsetY`, `blur`, `spread` | `inset` (the skill notes for the template adoption already flagged this) |
| `fontWeight` | number 1–1000 or one of 19 keywords | variable-font axis syntax |

The rules exist for good reasons. DTCG targets Figma, Style Dictionary, iOS,
and Android at once, so a value has to survive translation into all of them.
That same portability is what makes it wrong as the surface a web developer
types into. Writing `{ "colorSpace": "srgb", "components": [0, 0.4, 0.8], "hex": "#0066cc" }`
to say `#0066cc` is the price of the interchange guarantee, and there is no
reason to pay it at the keyboard.

### The package is already a dialect, not an implementation

`serializeColor` returns any string unchanged (`serialize.ts:106`), and
`serializeMeasure` does the same (`serialize.ts:136`). Both then also accept
the DTCG object forms. That superset is what makes the demo theme readable:
`demos/theme/app/theme.ts` writes `"oklch(98.5% 0.002 247.839)"` and
`"0.25rem"`, neither of which is a conformant `$value`.

So the document that `createTheme` accepts today is not a DTCG document. It is
a CSS dialect that borrowed DTCG's `$` sigils, and every `$value` wrapper in it
buys nothing. Meanwhile the parts of DTCG that would matter to a real Figma
export are missing: `$root`, `$extends`, `$ref`, `typography`, and composite
sub-values written as nested token objects all fail against `parseTokens` and
`serialize`.

The choice is not whether to be DTCG-conformant. It is where to spend the
conformance budget. Spending it on the import path is checkable against real
Figma output. Spending it on the authoring path taxes every line a developer
writes and still leaves the import path broken.

### The authoring cost, measured

`demos/theme/app/theme.ts` carries 39 tokens across 9 groups plus a
6-token dark override. The document plus its `modes` option is 105 lines and
3,884 characters, of which 45 are `$value` wrappers and 11 are `$type`
declarations.

Transcribed into the format proposed below, with dark values moved inline onto
the tokens they override, the same theme is **63 lines and 2,323 characters**:
40 percent less of both. It compiles to byte-identical CSS, verified against
`compileThemeCss` (see "What was verified").

## Architecture

One intermediate representation, two front ends, three back ends. The IR
already exists: `parseTokens` returns `Map<string, ParsedToken>`, and
everything downstream of it reads only that map.

```
  TypeScript authoring ─┐
                        ├─→  lower()  ─→  DTCG document  ─→  parseTokens  ─→  IR  ─┬─→  CSS custom properties + <Theme />
  DTCG document (in) ───┘                                                          ├─→  DTCG document(s) (out)
                                                                                   └─→  typed module (codegen)
```

The lowering step is the whole trick. The authoring format compiles to a DTCG
document in memory, which means `tokens.ts`, `serialize.ts`, and the CSS
emitter need no changes at all, and the export path is nearly free because the
document already exists.

## The authoring format

### One export per token type, dual-purpose

Twelve exports named exactly after the twelve DTCG `$type` values. Each is a
leaf constructor when handed a value and a group tag when handed a record:

```ts
import { color, createTheme, cubicBezier, dimension, duration, fontFamily, fontWeight } from "@pitlane/theme";

createTheme({
    color: color({
        gray: { 50: "oklch(98.5% 0.002 247.839)", 900: "oklch(21% 0.034 264.665)" },
        white: "#fff",
    }),
    space: dimension({ xs: "0.25rem", md: "1rem", xl: "2.5rem" }),
    weight: fontWeight({ regular: 400, medium: "medium", bold: 700 }),
    font: fontFamily({ sans: ["Inter var", "ui-sans-serif", "system-ui"] }),
    motion: {
        fast: duration("150ms"),
        ease: cubicBezier([0.25, 0.1, 0.25, 1]),
    },
});
```

The disambiguation is structural and total for the eight scalar types: a color
value is a string, a dimension value is a string, a font family is a string or
array, a cubic Bézier is an array, so a plain record can only be a nested
group. The four composite types (`shadow`, `border`, `transition`, `gradient`)
take an object as their value, so they are leaf-only; group them with a plain
object literal, as `motion` does above.

Type resolution follows the same precedence DTCG defines, spelled with
functions instead of `$` keys: the leaf constructor wins, then the enclosing
group tag. The type-level lowering `ToDTCG<T>` maps the authored type onto the
DTCG shape and hands it to the existing `TokenTree<T>`, so `types.ts` keeps its
brand machinery unchanged.

Metadata rides along as an optional second argument, which is unambiguous
because a two-argument call is always a leaf or always a tagged group:
`color("#fff", { description: "Page background", deprecated: true })`.

### References come from layering

Aliases stop being strings. `.extend(base => …)` hands the previous layer's
accessor to a callback, so a reference is an ordinary property access that
autocompletes, jumps to definition, and fails to compile when the target is
renamed:

```ts
export let { token: t, raw, Theme } = createTheme({
    color: color({ white: "#fff", gray: { 900: "oklch(21% 0.034 264.665)" } }),
}).extend(base => ({
    color: color({
        surface: base.color.white,
        text: base.color.gray[900],
    }),
}));
```

At lowering time, `base.color.white` is the string `var(--color-white)`, and
the lowering step reverses it through the `varName → key` map that
`parseTokens` already builds, emitting `{ "$value": "{color.white}" }`. The
exported document therefore contains real DTCG aliases, including inside
composite sub-values, rather than `var()` soup.

Layering is not a stylistic preference. A single self-referential literal,
`createTheme(t => ({ … t.color.white … }))`, does not type: TypeScript 7.0.2
resolves the circularity by inferring `t` as `{}`, and every reference through
it errors with TS2339. Both the chained and the bound forms of `.extend` infer
correctly. Layering is the only shape that works, and it happens to be the
shape a design system already has (primitives, then semantics, then component
tokens).

### Modes attach to the token

`options.modes` today is a parallel tree whose paths must mirror the document
by hand, and `theme-authoring.md` left "where do modes go on an extended
theme" as its one undesigned question. Attaching mode values to the token
answers it and deletes the mirroring:

```ts
.extend(base => ({
    color: color({
        surface: modes({ base: base.color.white, dark: base.color.gray[950] }),
        text: modes({ base: base.color.gray[900], dark: base.color.gray[50] }),
        muted: base.color.gray[500],
    }),
}))
```

Lowering splits each `modes()` leaf into a base `$value` and one entry per mode
in the override tree that `compileModeOverrides` already consumes. Verified
against the demo: the reconstructed override tree is deep-equal to the
hand-written `modes.dark` object, and the emitted CSS matches byte for byte.

This is also the natural home for the generalization `theme-authoring.md` P4
wanted. Modes are currently hardcoded to `light` and `dark` with a
`prefers-color-scheme` media query (`theme.ts:206`). Named modes with declared
conditions (`{ dark: { media: "(prefers-color-scheme: dark)", selector: "[data-color-scheme=dark]" } }`)
fit the same lowering with no change to the authoring surface.

## DTCG at the edges

### Import

`fromDTCG(document)` in a `@pitlane/theme/dtcg` subpath, accepting a
conformant 2025.10 document and producing the same internal tree the authoring
format produces. This is where the conformance work belongs, and it is real
work: see "Conformance debt".

### Export

`toDTCG(theme)` returns the base document plus one document per mode. DTCG
itself has no mode concept; the [Resolver module](https://www.designtokens.org/tr/drafts/resolver/)
(preview draft, last updated June 2026) models exactly this as sets plus
modifiers in a `.resolver.json` manifest, so that is the export target for a
multi-mode theme.

Export is lossy in one direction and the docs must say so. Anything the
authoring format can express that DTCG cannot (`clamp()`, `em`, `%`,
`light-dark()`, inset shadows, `calc()` from a future `scale()` helper) has no
conformant representation. Options are to emit it under `$extensions`, to drop
it with a warning, or to refuse. Recommendation: emit under
`$extensions["tools.pitlane"]` and report the count, so a Style Dictionary
consumer gets a valid document and the author learns what did not travel.

### The build step

Both directions go through `@pitlane/theme/dtcg`, which stays runtime-only and
dependency-free, satisfying the runtime-first rule in `VISION.md`. Two thin
wrappers sit on top:

- `@pitlane/theme/vite` — watches an imported DTCG document and regenerates a
  typed module. This solves a problem the package already documents but cannot
  fix: `theme.ts:110-113` warns that "a JSON import widens its literals and the
  token brands degrade." Codegen writes the literals back out as
  `export const tokens = { … } as const`, so the accessor is fully branded.
- A `pitlane-theme` bin for the export direction and for CI. Exporting an
  interchange artifact is a one-shot job, not a web-build job, so it should not
  be bolted onto `vite build`.

Static CSS extraction and dead-token pruning are the obvious third job for a
build step. Both are out of scope here. They are optimizations, and
`VISION.md` is explicit that a bundler plugin may optimize the runtime API but
never become a prerequisite for it.

Placement is a subpath rather than a new package because the codegen and the IR
change together in both directions, which is the exception `VISION.md`
principle 5 carves out. The alternative, `@pitlane/theme-dtcg` as its own
package, would work and would keep the root install smaller; it costs a version
lockstep between two packages that always ship together.

## What this costs

| Surface | Change |
| --- | --- |
| `packages/theme/src/authoring.ts` (new) | The twelve factories, `modes()`, and `lower()` |
| `packages/theme/src/types.ts` | Add `ToDTCG<T>` and `DeepMerge<A, B>`; `TokenTree` unchanged |
| `packages/theme/src/theme.ts` | `createTheme` takes the authored tree; add `.extend` |
| `packages/theme/src/tokens.ts`, `serialize.ts` | Unchanged |
| `packages/theme/src/dtcg.ts` (new) | `fromDTCG`, `toDTCG` |
| `theme.test.ts`, `types.test-d.ts` | Fixtures rewritten (20 and 11 tests); assertions survive |
| `tokens.test.ts`, `serialize.test.ts` | Unchanged; they become the DTCG import path's tests |
| `tva.test.ts`, `tva.test-d.ts`, `css.test-d.ts` | Unchanged (18 tests, format-agnostic) |
| `demos/theme/app/theme.ts` | Rewritten, 105 lines to 63 |
| `docs/guides/styling.md` | Two of eleven sections ("Define a theme", "A complete component") plus a paragraph in "Dark mode" |
| `packages/theme/README.md` | Quick start |
| `docs/internal/VISION.md` | The `createTheme` example at L773-830 |

## Conformance debt on the import path

Independent of this proposal, measured against 2025.10:

| Gap | Where |
| --- | --- |
| `$root` (a group carrying its own token) | `walk` treats any node without `$value` as a group |
| `$extends` (group inheritance) | not implemented |
| `$ref` (JSON Pointer, including into sub-values) | not implemented; only `{dotted.path}` is recognized |
| `typography` composite | thrown by `validateType` (`tokens.ts:159`) |
| Composite sub-value written as a nested token object | `field()` passes it to the type serializer, which rejects it |
| `hex` treated as the value rather than a fallback | `serialize.ts:114` returns `hex` before reading `colorSpace`, so a `display-p3` or `oklch` token silently degrades to sRGB |

The last one is a bug today, not a gap. A wide-gamut color authored in the
structured form loses its gamut in the emitted CSS. Worth fixing on its own.

## Reconciling the earlier proposal

| Earlier | Now |
| --- | --- |
| P1, token composition via `.extend` | Survives, and becomes load-bearing: layering is the only form that types. Its open question about modes is answered by attaching them to the token. |
| P2, `DefaultTheme` plus `pick` | Survives unchanged. `pick` gets easier, since a group is a function call rather than a bag of `$`-keyed siblings. |
| P3, `scale()` multipliers | Survives and gets simpler: dimension values are CSS strings by design, so `calc()` needs no special case. New consequence: `calc()` cannot be exported conformantly. |
| P4, `lightDark()` | Mostly subsumed. With real per-token modes, `light-dark()` is only needed for per-subtree `color-scheme` flipping. The mode-selector half of P4 survives and folds into the named-mode generalization. |
| P5, modifier leaves | Unchanged, still last. The dual-purpose factory gives the metadata argument a place to live, which is where `$modifiers` would go. |

## Open questions

1. **Export names.** `color`, `number`, `shadow`, `border`, `transition`, and
   `gradient` are plausible local variable names, so collisions will happen and
   `import { color as colorTokens }` is the escape hatch. The alternative is a
   single `tokens` namespace object (`tokens.color({ … })`), which costs seven
   characters at every call site and removes the collision entirely. Matching
   the DTCG `$type` spelling exactly is worth something for anyone moving
   between the two formats.
2. **Recompile cost of layering.** Each `.extend` recompiles the accumulated
   document. `theme-authoring.md` measured one extend at 0.82 ms against 0.55 ms
   for a single compile on a 284-token theme. Three layers is still under
   2 ms at module load, but the cost is linear in layers and worth capping or
   documenting.
3. **Where mode conditions are declared.** On `createTheme` options, or on the
   `modes()` call, or a separate `defineModes()`. Only the first keeps a mode's
   condition declared once.
4. **Does `fromDTCG` produce a typed accessor at all?** A runtime-loaded JSON
   document cannot, which is the entire reason the codegen exists. `fromDTCG`
   should probably return an untyped-accessor theme and the docs should point
   at the build step for the typed path.

## What was verified

Spikes run against the real `packages/theme/src`, then deleted.

- **Type inference.** Dual-purpose factories, `ToDTCG<T>` feeding the unmodified
  `TokenTree<T>`, and `DeepMerge` override through two `.extend` layers: nine
  assertions, all passing under `tsc` 7.0.2 with `--strict`. Each assertion was
  confirmed to fail when deliberately mis-stated.
- **Self-reference.** `createTheme(t => …)` fails: `t` infers as `{}`, three
  TS2339 errors. Both `.extend` forms, chained and bound, infer correctly.
- **Lowering.** A lowered document is deep-equal to the hand-written DTCG
  equivalent, and `compileThemeCss` returns identical text for both.
- **Alias reversal.** Accessor references lower back to `{dotted.path}` aliases,
  including inside a shadow's `color` sub-value. The alias keeps its `var()`
  indirection in the emitted CSS, and `raw()` chases it to the concrete value.
- **Demo parity.** The full demo theme, transcribed into the proposed format
  with inline `modes()`, emits CSS byte-identical to the current document, and
  its reconstructed mode override tree is deep-equal to the hand-written
  `modes.dark`.

Not verified: the metadata second argument, `fromDTCG`, `toDTCG`, the resolver
manifest, and named modes with declared conditions.
