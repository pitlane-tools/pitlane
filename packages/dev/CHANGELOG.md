# @pitlane/dev

## 0.2.0

Target Remix `3.0.0-beta.10`.

- Raised the `remix` peer dependency to `^3.0.0-beta.10` (from
  `^3.0.0-beta.5`). Remix beta.6 removed the legacy package-aligned `remix/*`
  import aliases, so beta.5 and earlier are no longer supported.
- `run()` from `remix/ui` now ships a default frame resolver and takes
  `(src, options)`, so the documented `app/entry.browser.ts` no longer needs a
  hand-written `resolveFrame`. The plugin itself is unchanged.
- Tested against Vite 8.1 (Rolldown), Vite+ 0.2 (`vp`), and
  `remix@3.0.0-beta.10`.

## 0.1.1

No changes to the plugin. First release published through the tokenless
trusted-publishing pipeline — this version and everything after it carries an
npm provenance attestation (0.1.0 was published locally while the pipeline was
bootstrapped).

## 0.1.0

Initial release.

- `remix()` — Remix 3 build orchestration for any Vite or Vite+ project:
  SSR-before-client multi-environment builds into `dist/ssr` + `dist/client`,
  dev serving through the app's default-exported fetch handler, and a preview
  server for the production build.
- `clientEntry()` hydration transform: named-export components become
  hydratable islands; `import.meta.url` resolves to production asset URLs.
- The `?assets=` import protocol plus `mergeAssets` from
  `@pitlane/dev/runtime`, with ambient types via `@pitlane/dev/assets`.
- Platform-agnostic by construction: composes with
  `@cloudflare/vite-plugin`, `@netlify/vite-plugin`, and `nitro/vite`, or the
  built handler runs directly on Node, Bun, and Deno. The assets manifest is
  written eagerly and synthesized from bundle captures when an orchestrator
  bundles the SSR output itself; runtime helpers are inlined into builds; dev
  responses are normalized for runtimes with strict `node:http` semantics.
- Tested against Vite 8.1 (Rolldown), Vite+ 0.2 (`vp`), and
  `remix@3.0.0-beta.5` across the eight
  [pitlane-tools/templates](https://github.com/pitlane-tools/templates)
  deploy targets.
