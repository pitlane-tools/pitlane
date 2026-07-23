---
title: CLI
description: Reference for the pitlane CLI — database, secrets, resources, and deploy commands.
---

# CLI

The `pitlane` CLI wraps Cloudflare platform operations for Remix apps. It reads Cloudflare resources from the `platform()` plugin in `vite.config.ts`.

Pitlane does not replace Vite+ lifecycle commands. Use `vp dev`, `vp check`, `vp test`, and `vp build` for application work.

## Database

```bash
pitlane db generate
pitlane db push
pitlane db migrate
pitlane db migrate --remote
pitlane db reset
pitlane db seed
```

Use database commands for D1 schema generation, local migrations, remote migrations, reset, and seed flows.

## Secrets

```bash
pitlane secrets push
pitlane secrets list
```

`pitlane secrets push` reads `.env`, compares it with deployed Cloudflare secret names, and pushes changes. Cloudflare secret values are write-only.

## Resources

```bash
pitlane resources list
pitlane resources create
pitlane resources link
```

Resource provisioning is explicit. `pitlane resources create` reads `platform()` and creates the configured D1, KV, R2, and queue resources. Cron triggers are generated into Wrangler config and applied during deploy.

## Deploy

```bash
pitlane deploy
pitlane deploy --dry-run
```

`pitlane deploy` builds the app, applies pending remote migrations, deploys with Wrangler, and prints the live URL.

## Setup

```bash
pitlane setup
```

`pitlane setup` writes `.github/workflows/deploy.yml` using `pitlane-tools/deploy-action`. When `gh` is available and authenticated, it can help initialize the repository, create a GitHub remote, configure Cloudflare credentials, and write the workflow.

## Auth

```bash
pitlane login
pitlane whoami
```

Authentication delegates to Wrangler so Pitlane uses the same Cloudflare identity as the rest of your Cloudflare tooling.
