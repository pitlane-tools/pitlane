---
title: Configuration
---

# Configuration

Pitlane configuration starts in `vite.config.ts`.

## Remix Plugin

`remix()` configures the Remix 3 framework build for Vite+:

```ts
import { defineConfig } from 'vite-plus';
import { remix } from 'pitlane/remix';

export default defineConfig({
  plugins: [
    remix({
      clientEntry: 'app/entry.browser',
      serverEntry: 'app/entry.server',
      serverEnvironments: ['ssr'],
      serverHandler: false,
    }),
  ],
});
```

All options are optional. The plugin configures SSR and client Vite environments, transforms client entry references, wires preview server behavior, and suppresses expected abort errors from client disconnects.

## Platform Plugin

`platform()` is the source of truth for Cloudflare resources:

```ts
import { defineConfig } from 'vite-plus';
import { remix } from 'pitlane/remix';
import { platform } from 'pitlane/platform';

export default defineConfig({
  plugins: [
    remix(),
    platform({
      name: 'contacts',
      compatibilityDate: '2026-04-08',
      d1: { binding: 'DB', database: 'contacts' },
      kv: { binding: 'SESSIONS' },
      r2: { binding: 'FILES' },
      queues: { binding: 'TASKS', queue: 'task-queue' },
      cron: '0 * * * *',
    }),
  ],
});
```

Pitlane generates `.pitlane/wrangler.jsonc` from this config and runs Wrangler type generation into `.pitlane/worker-configuration.d.ts`.

## Multiple Bindings

Binding resource types (`d1`, `kv`, `r2`, and `queues`) accept one object or an array. `cron` accepts one cron string or an array of cron strings:

```ts
platform({
  d1: [
    { binding: 'DB', database: 'primary' },
    { binding: 'ANALYTICS_DB', database: 'analytics' },
  ],
  kv: [{ binding: 'CACHE' }, { binding: 'SESSIONS' }],
  r2: [{ binding: 'UPLOADS' }, { binding: 'ASSETS' }],
  queues: [
    { binding: 'TASKS', queue: 'task-queue' },
    { binding: 'EMAILS', queue: 'email-queue' },
  ],
  cron: ['0 * * * *', '0 0 * * *'],
});
```

When you configure multiple bindings of the same type, create additional Remix context keys and add one middleware call per binding.
