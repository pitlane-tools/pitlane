# Pitlane Documentation Site Design

## Purpose

Create a public documentation site for Pitlane aimed at early adopters trying to use the product successfully. The docs should treat Pitlane as a realized product, even though the repository currently contains conceptual source material rather than implementation packages.

The primary source of truth is `pitlane.md`. The Vite+ relationship and command surface should be derived from `vite-plus.md`.

## Audience

The site is for developers building Remix 3 applications on Cloudflare who want Pitlane to handle platform integration, generated Cloudflare configuration, typed bindings, platform middleware, CLI operations, and deploy workflows.

The docs should prioritize:

- first successful project creation
- clear separation between Vite+ and Pitlane responsibilities
- copy-pasteable configuration and runtime examples
- practical Cloudflare deployment guidance

## Tooling

Keep the existing `docs/` VitePress site and VoidZero theme. Convert the repository into a Vite+ project so docs workflows run through Vite+.

Expected project-level additions:

- root `package.json`
- root `vite.config.ts`
- root `.gitignore` if needed

VitePress commands should be exposed through Vite+ task/script execution. Because VitePress is a package binary rather than a built-in Vite+ command, use `vp run` for docs-specific tasks such as:

- `vp run docs:dev`
- `vp run docs:build`
- `vp run docs:serve`

The command implementations can call VitePress through `vp exec vitepress ...`.

## Information Architecture

Use the existing `docs/` directory as the public documentation root.

Pages:

- `index.md`: home page frontmatter only, backed by the custom home layout.
- `guides/getting-started.md`: quick path from scaffold to first deploy.
- `guides/vite-plus.md`: how Vite+ and Pitlane work together.
- `guides/configuration.md`: `remix()` and `platform()` Vite config.
- `guides/platform-primitives.md`: D1, R2, KV sessions, queues/jobs, and cron.
- `guides/cli.md`: `pitlane` command responsibilities and command reference.
- `guides/deployment.md`: local deploy and GitHub Actions deploy flow.
- `guides/scaffolding.md`: `vp create pitlane` prompts and generated project shape.

The sidebar should group these as a practical guide sequence rather than an exhaustive API reference.

## Public Messaging

The home page should make Pitlane the first-viewport signal. The core value proposition:

Pitlane gives Remix 3 apps first-class Cloudflare platform integration using Vite+, explicit configuration, typed bindings, platform middleware, and deployment tooling.

Avoid describing Pitlane as conceptual, planned, hypothetical, or unfinished in public docs.

Feature themes for the home page:

- Vite+ native workflow
- explicit Cloudflare configuration through `platform()`
- typed platform primitives through middleware and context keys
- one command surface for platform operations
- deploys through local CLI or GitHub Actions

## Vite+ And Pitlane Relationship

The docs should clearly separate the tools:

- Vite+ owns project lifecycle commands: `vp create`, `vp install`, `vp dev`, `vp check`, `vp test`, `vp build`, `vp preview`, and dependency management.
- Pitlane owns Cloudflare platform operations: resource creation, D1 migrations, secrets sync, generated Wrangler config, and deployment.

Examples should use `vite-plus` imports:

```ts
import { defineConfig } from "vite-plus";
import { remix } from "pitlane/remix";
import { platform } from "pitlane/platform";

export default defineConfig({
    plugins: [
        remix(),
        platform({
            d1: { binding: "DB", database: "contacts" },
        }),
    ],
});
```

## Content Source Rules

Rewrite content from `pitlane.md` into user-facing documentation. Do not copy the product spec wholesale.

Use task-oriented language:

- "Create a project"
- "Configure Cloudflare resources"
- "Add platform middleware"
- "Run migrations"
- "Deploy"

Keep APIs aligned with `pitlane.md`. Do not invent extra flags, exports, config fields, or unsupported resource types.

## Visual Design

Stay within the existing VoidZero VitePress theme. Replace placeholder copy and branding with Pitlane-specific content.

Use the checked-in Pitlane logo assets. Update:

- VitePress title
- logo alt text
- nav and sidebar labels
- social link target
- home hero copy
- intro copy
- feature grid copy
- footer CTA copy

Avoid a marketing-only landing page. The home page should quickly direct users to the getting started flow and GitHub source.

## Verification

After implementation:

1. Run dependency installation through Vite+.
2. Run the docs build through Vite+.
3. Start the docs dev server.
4. Provide the local URL.

If a Vite+ binary is unavailable locally, report the blocker and use the closest available fallback only for diagnosis.

## Out Of Scope

- Implementing Pitlane packages.
- Publishing the docs site.
- Creating a full generated API reference.
- Adding a search index beyond VitePress defaults.
- Writing documentation for post-MVP MCP features beyond brief mention where already present in source material.
