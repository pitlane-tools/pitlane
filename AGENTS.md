# Repository conventions

## Docs prose linting

User-facing docs (`docs/package/`, `docs/guides/`) are linted with [Vale](https://vale.sh) using the [vale-ai-tells](https://github.com/tbhb/vale-ai-tells) style package. Configuration lives in `.vale.ini`; synced styles land in the gitignored `.vale/` directory.

**Every time you edit a page under `docs/package/` or `docs/guides/`, run Vale on it and fix the findings before committing:**

```sh
vale docs/package/theme.md   # one page
pnpm docs:prose              # sync styles + lint all user-facing docs
```

If `vale` is not installed: `brew install vale`, then `vale sync` at the repo root.

Internal documents (`docs/internal/`, `docs/superpowers/`) are exempt.
