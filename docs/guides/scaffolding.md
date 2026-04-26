---
title: Scaffolding
---

# Scaffolding

Create a Pitlane project with Vite+:

```bash
vp create pitlane
```

By default `create-pitlane` bootstraps a project with:

- `vite.config.ts` using `remix()` and `platform()`
- `app/entry.server.tsx` with the Remix middleware stack
- `pitlane/cli` as a development dependency
- `.pitlane/` in `.gitignore`

## Platform Features

```text
? Platform features:
  ☐ Database (D1)
  ☐ File Storage (R2)
  ☐ Session Storage (KV)
  ☐ Queues
  ☐ Cron Jobs
```

Pitlane wires selected platform features into `platform()` and the server entry.

## Project Features

```text
? Project features:
  ☐ Authentication
  ☐ Testing
  ☐ Prerendering
  ☐ Content Layer (MDX)
  ☐ Tailwind (CSS)
  ☐ CI/CD (GitHub Actions)
```

Project features add framework-level setup such as auth, tests, prerendering, MDX content, Tailwind, and deployment workflows.

## Example With Optional Features

This tree shows a project with optional features selected:

```text
my-app/
├── .github/workflows/deploy.yml
├── app/
│   ├── entry.server.tsx
│   ├── home.tsx
│   ├── jobs.ts
│   ├── root.tsx
│   ├── routes.ts
│   ├── schema.ts
│   └── styles/tailwind.css
├── seed.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

With no optional features selected, the project is a minimal Remix app on Cloudflare with Vite+ and Pitlane platform configuration.
