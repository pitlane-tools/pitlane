# Repository conventions

## Docs prose linting

User-facing docs (`docs/package/`, `docs/guides/`) are linted with [Vale](https://vale.sh) using the [vale-ai-tells](https://github.com/tbhb/vale-ai-tells) style package. Configuration lives in `.vale.ini`; synced styles land in the gitignored `.vale/` directory.

The oh-my-pi hook at `.omp/hooks/vale-prose.ts` automates this: after every successful `edit`/`write` touching those directories, it appends Vale's findings to the tool result, so the agent sees prose feedback immediately. The hook loads at session start and no-ops when `vale` is missing.

**When the hook is inactive (or you are a different agent), run Vale manually after every edit to a page under `docs/package/` or `docs/guides/`, and fix the findings before committing:**

```sh
vale docs/package/theme.md   # one page
vp run docs:prose              # sync styles + lint all user-facing docs
```

If `vale` is not installed: `brew install vale`, then `vale sync` at the repo root.

Internal documents (`docs/internal/`, `docs/superpowers/`) are exempt.
