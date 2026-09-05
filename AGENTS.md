# Repository conventions

## Tasks

Repo-level tasks live in `mise.toml` and run through Mise: `mise run docs:dev`,
`mise run docs:build`, `mise run fmt`, `mise run check`. Per-package tasks live
in each package's `vite.config.ts` and run through Vite+: `vp test`,
`vp run build` from inside `packages/<name>`. CI follows the same split — the
docs workflows use Mise, the package workflows use Vite+.

## Releases

A release is a git tag plus a GitHub release on `main`. That is the only thing
`.github/workflows/publish.yml` listens for (`on: release: types: [published]`),
and it is the only route to npm for a package that already exists there. Never
cut a tag or a release from a feature branch, and never reach for `npm publish`
to ship a version the workflow could have shipped.

This section is the mechanics. The order around them — what to update before
the merge, and what is still in its pre-release state after the tag — is
`.agents/skills/releasing-pitlane-packages/SKILL.md`.

A feature PR **may** carry the version bump and the changelog entry for the
release it is heading toward: `@pitlane/dev@0.3.0` was tagged directly on the
squashed PR commit that bumped it. That stages a release. It does not perform
one, and the distinction is worth keeping visible in the history:

- **`release:` is a commit scope reserved for version-only commits**, like
  `f6be34e release: @pitlane/dev@0.2.0 and @pitlane/theme@0.2.0`. A commit that
  also changes code or prose takes the scope of what it changes.
- **Never put "release `<package>` `<version>`" in a commit subject** unless the
  commit is that version-only bump. A subject that claims a release nobody
  performed costs a reviewer the time it takes to disprove it. Note the bump in
  the body instead.

Checking what is actually published beats reasoning about it:

```sh
npm view @pitlane/dev versions     # what npm has
git ls-remote --tags origin        # what has been tagged
```

### A package's first publish is manual, once

`publish.yml` authenticates through npm Trusted Publishing (OIDC). A trusted
publisher cannot be configured for a package that does not exist yet, so the
workflow cannot perform a package's **first** publish: it fails with
`ENEEDAUTH`, which is not a misconfiguration and not worth debugging. That is
the one case where publishing from a laptop is correct.

Cut the tag and the GitHub release first, exactly as always. Then, from the
released commit with a clean tree:

```sh
git checkout main && git pull --ff-only
git rev-parse --short HEAD '@pitlane/<name>@<version>^{commit}'   # must match

cd packages/<name>
vp test && vp run build          # the gates publish.yml would have run
npm pack --dry-run               # read the file list before it is permanent

npm login --auth-type=web
npm publish --access public --tag latest
```

Two flags earn their place. `--access public` is required because a scoped
package defaults to restricted, and the default would publish something nobody
can install. `--provenance` is **omitted**: it needs a CI OIDC token, so it
fails from a laptop. That first version is the only one without a provenance
attestation.

With 2FA set to `auth-and-writes`, `npm publish` opens a second browser
approval after `npm login`. Both are interactive, so run them where a person
can answer.

Afterwards, configure the trusted publisher on npmjs.com (package settings →
Trusted Publisher → GitHub Actions, naming this repo and `publish.yml`). Every
later version then goes through the release workflow, with provenance.

Expect `npm view` to 404 for several minutes after a first publish while the
packument cache invalidates. The publish still succeeded; check the parts that
update first:

```sh
curl -sI https://registry.npmjs.org/@pitlane/<name>/-/<name>-<version>.tgz
npm access list packages @pitlane
```

### Preview builds are not releases

`pkg-preview.yml` publishes an installable build of `@pitlane/dev` to
[pkg.pr.new](https://pkg.pr.new) on every branch push and pull request. Its job
is named `preview` so a green check on a PR cannot be mistaken for a publish;
it was called `publish` once, and it was. The npm workflow has no `push` or
`pull_request` trigger and cannot run on a PR at all.

Releasing a package that the [templates](https://github.com/pitlane-tools/templates)
depend on has one more ordering rule: publish the package first, then merge the
companion templates branch. See
`.agents/skills/adopting-packages-into-templates/SKILL.md`.

## Package reference docs are generated

Every page under `docs/package/` is emitted by TypeDoc from the packages'
TSDoc comments and is gitignored. The whole TypeDoc setup lives in `.typedoc/`:
one config per documented package (`dev.json`, `theme.json`, `crawler.json`,
`data-table-d1.json`, `tui.json`), each extending `base.json`, which registers
the local theme and router in `plugin.mjs`. `mise run docs:api` runs them all.

Paths inside those configs resolve relative to the config file, not the repo
root, so a package's entry points read `../packages/<name>/src/...` and its
output `../docs/package/<name>`. Adding a documented package means adding a
config there plus a line in the `docs:api` task.

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
