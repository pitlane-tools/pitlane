---
title: Deployment
description: Deploy Remix apps to Cloudflare with Pitlane — locally and from CI.
---

# Deployment

Pitlane deploys Remix apps to Cloudflare using configuration generated from `platform()`.

## Local Deploy

```bash
vp check
pitlane deploy
```

The deploy flow:

1. Builds the project with Vite+.
2. Runs pending remote D1 migrations.
3. Stops if a migration fails.
4. Runs Wrangler deploy with `.pitlane/wrangler.jsonc`.
5. Prints the live URL.

Use a dry run before applying changes:

```bash
pitlane deploy --dry-run
```

## GitHub Actions

Use `pitlane-tools/deploy-action` after the app is built:

```yaml
name: Build & Deploy

on:
    push:
        branches: [main]

permissions:
    contents: read
    deployments: write

jobs:
    deploy:
        runs-on: ubuntu-latest
        environment:
            name: production
            url: https://my-app.example.com
        steps:
            - uses: actions/checkout@v4

            - uses: voidzero-dev/setup-vp@v1
              with:
                  node-version: "24"
                  cache: true

            - run: vp install --frozen-lockfile
            - run: vp check
            - run: vp build

            - uses: pitlane-tools/deploy-action@v1
              with:
                  cloudflareApiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

The action handles Pitlane's platform deploy steps. Your workflow remains responsible for checkout, Vite+ setup, dependency installation, checks, and build.
