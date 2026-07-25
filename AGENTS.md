# Repository conventions

## Tasks

Repo-level tasks live in `mise.toml` and run through Mise: `mise run docs:dev`,
`mise run docs:build`, `mise run fmt`, `mise run check`. Per-package tasks live
in each package's `vite.config.ts` and run through Vite+: `vp test`,
`vp run build` from inside `packages/<name>`. CI follows the same split — the
docs workflows use Mise, the package workflows use Vite+.

## Package reference docs are generated

Every page under `docs/package/` is emitted by TypeDoc from the packages'
TSDoc comments and is gitignored. One config per package (`typedoc.dev.json`,
`typedoc.theme.json`, both extending `typedoc.base.json`), all run by
`mise run docs:api`.

Never edit a file under `docs/package/`; the next build overwrites it. Change
the TSDoc comment in `packages/<name>/src/` instead. Narrative documentation
belongs in `docs/guides/`.

## Docs prose linting

Hand-written user-facing docs are linted with [Vale](https://vale.sh) using the
[vale-ai-tells](https://github.com/tbhb/vale-ai-tells) style package.
Configuration lives in `.vale.ini`; synced styles land in the gitignored
`.vale/` directory.

The oh-my-pi hook at `.omp/hooks/vale-prose.ts` automates this: after every
successful `edit`/`write` touching those directories, it appends Vale's
findings to the tool result, so the agent sees prose feedback immediately. The
hook loads at session start and no-ops when `vale` is missing.

**When the hook is inactive (or you are a different agent), run Vale manually
after every edit to a page under `docs/guides/`, and fix the findings before
committing:**

```sh
vale docs/guides/styling.md   # one page
mise run docs:prose           # sync styles + lint all user-facing docs
```

If `vale` is not installed: `mise install`, or `brew install vale` followed by
`vale sync` at the repo root.

Internal documents (`docs/internal/`, `docs/superpowers/`) are exempt.
