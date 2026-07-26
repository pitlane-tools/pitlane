---
name: adopting-packages-into-templates
description: Use when a package in the pitlane monorepo is heading toward its first publish, or has changed in a way the pitlane-tools/templates starters should follow. Also use when deciding whether a package belongs in the templates at all, or when a templates branch has to land in tandem with a package release.
---

# Adopting Packages into the Templates

## Overview

The starters in `pitlane-tools/templates` are the only place a Pitlane package
meets a real app on every deploy target. Adopting a package there **before** it
publishes is how its API gaps surface while they are still free to fix. The
adoption work is a companion branch, not a follow-up: it merges in tandem with
the release.

## Does the package belong?

Adopt when the templates already hand-roll what the package does, or when every
template would reach for it. `@pitlane/theme` qualified on both counts: all
eight starters shipped a byte-identical 163-line hand-rolled token module that
`createTheme` replaces outright.

Do not adopt a package that serves one deploy target, that a starter app can do
without, or that makes the starter harder to read. A starter that advertises a
package is worse than one that needs it.

## The companion branch

Give the templates branch the same name as the package branch. It declares the
range the package is about to publish (`^0.1.0`), so it cannot install or build
from a clean checkout until the release lands. That is the intended state.

Release order: publish the package, then merge the templates branch.

## Procedure

1. **Convert one template first.** The `app/` code is near-identical across
   templates, so settle every decision once: what moves to `app/theme.ts`, what
   stays in `app/styles/preflight.css`, which callsites change.
2. **Replicate verbatim.** The templates stay as close to identical as they are
   today. A per-template flourish is a maintenance tax on eight repos.
3. **Wire the dependency by role.** Runtime code the app imports goes in
   `dependencies` beside `remix`. A build-time plugin goes in
   `devDependencies` beside `@pitlane/dev`. Deno templates take
   `"npm:<name>@^x.y.z"` in the `imports` map of `deno.json`/`deno.jsonc`.
4. **Verify against a local tarball.** The package is unpublished, so build one:

    ```sh
    cd packages/<name> && vp run build && pnpm pack --pack-destination /tmp
    ```

    Add an override to the templates' ROOT `pnpm-workspace.yaml`, install, and
    build every pnpm template:

    ```yaml
    overrides:
        "@pitlane/<name>": "file:/tmp/pitlane-<name>-0.1.0.tgz"
    ```

5. **Revert the override before committing.** The committed branch must contain
   no tarball path and no lockfile churn from the override.

## Prove the output, not just the build

A template that compiles can still render nothing. Run one template and capture
what the package actually emitted: the `<style>` it injected, the custom
property names, the media block. Check those names against whatever hand-written
CSS still references them. This is the step that catches a kebab-casing
mismatch between `t.colors.text.primary` and `var(--colors-text-primary)`.

## Friction is the deliverable

Every workaround the conversion forces is a bug report against the package,
written down while the details are fresh: what you wrote, the exact error, what
you did instead. Adopting `@pitlane/theme` surfaced that DTCG shadow objects
have no `inset` field, and that the string form of a `dimension` is an
unvalidated passthrough. Both went back into the package docs.

### Blame the right layer before you report

**Reproduce the failure with the package removed.** An adoption pass makes the
new package the obvious suspect for every error it appears near, and that
instinct is wrong often enough to cost hours.

A concrete miss: three `mix={[...]}` arrays failed to typecheck, the branded
`css()` sat in each one, and it looked like a publish blocker. The real cause
was remix/ui's `Element`-noded mixins (`inputStyle` from `remix/ui/combobox`,
`button()`) on typed host elements. Compiling `main`'s own unmodified
`Welcome.tsx` produced the identical errors with no `@pitlane/theme` anywhere
in the program. It had been failing on `main` the whole time, invisibly.

**Hold the program constant when you reduce.** Both arms must share one
tsconfig, one install, and one file set; otherwise you are measuring the
harness. Two traps burned an hour on that investigation:

- A scratch `tsconfig.json` that `extends` the template's but lives outside
  the package directory. `types` and `typeRoots` resolve relative to the
  extending file, so `@types/node` and friends silently drop out and the
  errors vanish for reasons that have nothing to do with your change. Put the
  scratch config in the same directory as the real one.
- Comparing a converted tree against `main` across two different
  `node_modules` states. Copy `main`'s version of the file into the current
  tree and compile both there.

## Know what CI actually gates

`ci.yml` runs `vp build` for the node templates and `deno task build` plus
`deno task check` for the Deno ones. **The node templates are never
typechecked**, so latent type errors accumulate there invisibly. Do not treat a
`tsc` delta as an acceptance gate, and do not fix unrelated pre-existing type
errors inside the adoption commits. Report them.

## Common mistakes

| Mistake                                                           | Do instead                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| Committing the tarball override or its lockfile churn             | Commit the published semver range; the override is a local device |
| Putting a runtime package in `devDependencies`                    | Match the role: imported by app code means `dependencies`         |
| Assuming an error near the new package is the new package's fault | Reduce it with the import deleted, then report                    |
| Fixing unrelated breakage in the adoption commits                 | Separate commit, or a separate report                             |
| Letting one template drift from the others                        | Settle the pattern once, replicate it verbatim                    |
| Treating a green build as proof                                   | Run it and read the emitted CSS or HTML                           |
