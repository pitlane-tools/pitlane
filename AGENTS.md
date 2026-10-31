# Agent Contract

This repository runs the **Workbench** process: a human approves intent in a proposal, agents implement it as tests, guides, and code, and an independent review checks them before the human does. [`PROCESS.md`](PROCESS.md) holds the loop; the skills below hold the procedures.

```sh
mise run status   # phase, next action, who acts
bd prime          # the work graph and what is ready
```

Run both at the start of every session and whenever you are unsure where the work stands. "Keep going" or a plain description of a problem is enough; neither authorizes a proposal or a draft pull request.

## Does this change need a proposal?

Ask one question: **does this change decide something?**

- Intent already exists — a proposal promises the behavior, or it is obvious (a typo, a dead link, an unambiguous bug): implement it directly, saying which.
- It decides something: ask "do you want a proposal for this change?" and wait for an explicit yes. Only then branch, push, open a **draft** pull request, and write it with [`writing-a-proposal`](.agents/skills/writing-a-proposal/). Consent covers this change and its revisions, not the next.
- A small fix that turns out to decide something stops and asks.

Proposal status is the human's: they set `awaiting-implementation`, `accepted`, `returned-for-revisions`, and `rejected`. You set `active-review` at handoff and `implemented` in the accepted pull request before merge ([`completing-a-feature`](.agents/skills/completing-a-feature/)).

## Implementing an approved proposal

Use [`implementing-a-proposal`](.agents/skills/implementing-a-proposal/). In short:

1. Read the proposal's Detailed design and the code it touches.
2. Write failing tests for the behavior it specifies; watch each fail for the missing behavior.
3. When a user's experience changes, write the guide under `docs/app/content/guides/` from the proposal, not the code, then check it against the tests.
4. Write the code in `packages/<name>/`.
5. Verify with `mise run check`, plus `test:<pkg>` and `build:<pkg>` per changed package; report the output.
6. Hand off to [`reviewing-an-implementation`](.agents/skills/reviewing-an-implementation/): self-check, independent review, preview, then the readiness report, `active-review`, and a ready pull request — together.

Which of the three applies is a judgement; the order is not.

Work inline by default; delegate only independent slices on separate files, or a fresh-context reviewer. Dispatch the `implementer`, `reframer`, and `adversary` briefs in `.omp/agents/` by name — `modelRoles` in `.omp/config.yml` picks the model — and use `.omp/tools/dynamic-workflows/`'s `workflow` tool for dependent agent work.

## Rules

- **Stay inside the proposal.** Behavior it does not describe is not built; an out-of-scope defect becomes a Beads item ([Work tracking](#work-tracking)).
- **Raise ambiguity** rather than choosing silently.
- **Never substitute planning for understanding** ([`grounding-a-problem`](.agents/skills/grounding-a-problem/)): agent synthesis stays inference until verified.
- **Never silently encode an ontology decision** ([`ontology-review`](.agents/skills/ontology-review/)).
- **Never write production code before its failing test**, when behavior warrants one.
- **Never write a guide from finished code.**
- **Never claim work is done without running the verifying command this turn** ([`verification.md`](.agents/rules/verification.md)).
- **Find a bug's root cause before fixing it** ([`systematic-debugging`](.agents/skills/systematic-debugging/)).
- **The adversarial reviewer reports; it never edits.**
- **Never merge, publish, deploy, delete a branch, or force-push without explicit human confirmation.**
- **Every pull request carries a changeset**; `-- --empty` when nothing releasable changed.
- **Record a policy or decision only with the human.**

## Quality gates

```sh
mise run setup        # bootstrap a clone
mise run check        # the gate
mise run fmt          # Oxfmt; takes paths
mise run lint         # Oxlint --fix
mise run typecheck    # tsc
mise run test         # all suites; test:<pkg> for one
mise run build        # tsdown; build:<pkg> for one
mise run validate     # the record
mise run policies     # repository policies
mise run tools:test   # the tooling's own tests
mise run docs:prose   # Vale
mise run changeset    # every pull request carries one
mise run status       # phase and next action
```

`mise run check` is the gate — `hk check --all` (whitespace, newlines, conflict markers, actionlint, Oxfmt, Oxlint, typecheck) plus `validate`, `tools:test`, `policies`, and the docs tasks. Nothing is done until it passes this turn; the per-package suites stay in CI. `mise tasks` lists everything.

## Work tracking

Beads (`bd`) is the work tracker, the ready queue, and durable agent memory; it replaces issue-based defect tracking and TODO files. The proposal records **intent**; Beads records the **work graph**.

```sh
bd ready                 # what can be worked on now
bd show <id>             # read one item before touching it
bd update <id> --claim   # claim atomically before starting
bd create "Title" --description="why this exists" --type=task --priority=2
bd close <id> --reason="Completed"
bd remember "<fact>"     # durable project memory
```

Rules that matter:

- Never run `bd edit`; it opens an editor and hangs a non-interactive agent. Use `bd update` flags.
- Priorities are `0`–`4`, `0` highest, default `2`.
- Claim before starting; close only when the work is done.
- Never run `bd hooks install`; hk owns the hooks and runs `bd hooks run <hook>`.
- `.beads/issues.jsonl` is a committed passive export; the database is the source of truth.

A defect that blocks the current proposal is current work, not a new item. Skill: [`tracking-work`](.agents/skills/tracking-work/).

## Tooling

**Mise** owns toolchains, environment, and tasks from `mise.toml` and `mise.lock`; `[env] _.path` puts `node_modules/.bin` on `PATH`. Add a task rather than documenting a bare command.

**hk** owns every git hook, installed by `mise run setup` with `hk install --mise` — never another way, never bypassed. `commit-msg` runs `node tools/check-scoped-commit.ts` over [Scoped Commits](https://scopedcommits.com/) with the scopes in [`.agents/commit-scopes`](.agents/commit-scopes); `pre-push` runs the gate.

**Fnox** owns secrets: a task declares `secrets = [...]` in `mise.toml` and Fnox resolves them at task time. Never commit one.

**Beads (`bd`)** owns the work graph and agent memory. See [Work tracking](#work-tracking).

**Changesets** owns per-package release notes and versioning. Publishing is separate and human-authorized: a git tag plus a GitHub Release that `publish.yml` listens for.

**Worktrunk (`wt`)** owns worktrees: `wt switch --create <name>` installs its own toolchain and copies the files in `.worktreeinclude`.

**GitHub Actions** runs that same gate through `jdx/mise-action@v5` and `mise run deps:install`. A local pass with a CI failure is environmental, not a reason to special-case the workflow.

## Pitlane: a pnpm workspace of Remix 3 packages

Each package under `packages/<name>/` publishes as `@pitlane/<name>`, carries its own Vitest suite and tsdown build, and is documented at [pitlane.tools](https://pitlane.tools) from `docs/`. `packages/pitlane` is the umbrella that re-exports them all. Vite 8 is the product's platform, not a repository wrapper: the packages are Vite plugins and runtime libraries, and the repository's own tasks live in `mise.toml`.

### Tasks

mise owns every task and every toolchain. Node, pnpm, hk, fnox, `gh`, actionlint, `wt`, and `bd` are pinned in `mise.toml` and `mise.lock`; Oxfmt, Oxlint, tsdown, tsc, Vite, Vitest, TypeDoc, Vale, and Changesets are devDependencies that mise puts on `PATH`. `mise run setup` bootstraps a clone — `deps:install`, `bd init`, `hk install --mise`, and the vendored Remix skill refresh — and `mise run deps:install` alone runs `pnpm install --frozen-lockfile`. `mise tasks` lists the rest.

| Task | What it does |
| --- | --- |
| `mise run check` | the single gate; CI and `pre-push` run the same task |
| `mise run fmt` · `lint` · `typecheck` | Oxfmt, Oxlint `--fix`, tsc over the three TypeScript projects |
| `mise run test` · `test:<pkg>` | every package's Vitest suite, or one package's |
| `mise run build` · `build:<pkg>` | tsdown over every publishable package, or one with its workspace dependencies first |
| `mise run validate` · `policies` · `tools:test` | the record rules, the repository policies, and their own tests |
| `mise run docs:dev` · `docs:build` · `docs:serve` · `docs:test` | the documentation site |
| `mise run docs:api` · `docs:api:test` · `docs:mdx` · `docs:prose` | TypeDoc reference, its tests, the MDX typecheck, Vale |
| `mise run changeset` · `changeset:status` · `changeset:version` | release notes, the pending plan, and applying it |
| `mise run status` | phase, next action, who acts |

`<pkg>` is `assets`, `content`, `crawler`, `data-table-d1`, `pitlane`, `theme`, `vite-plugin-fetch-server`, or `vite-plugin-remix`.

### Releases

A release is a git tag plus a GitHub release on `main`. That is the only thing `.github/workflows/publish.yml` listens for (`on: release: types: [published]`), and it is the only route to npm for a package that already exists there. Never cut a tag or a release from a feature branch, and never reach for `npm publish` to ship a version the workflow could have shipped.

This section is the mechanics. The order around them — what to update before the merge, and what is still in its pre-release state after the tag — is [`.agents/skills/releasing-pitlane-packages/`](.agents/skills/releasing-pitlane-packages/).

Feature and fix pull requests capture consumer-visible package changes in `.changeset/*.md`, naming the affected packages and a patch, minor, or major bump. Write the body for someone deciding whether to upgrade. Keep package versions and numbered changelog sections unchanged until release preparation. A change confined to repository tooling or agent guidance releases nothing, so it carries an empty note instead; the `changeset` job in `test.yml` rejects a pull request that adds none.

```sh
mise run changeset             # add a pending note
mise run changeset -- --empty  # nothing releasable changed
mise run changeset:status      # inspect pending packages and bump levels
```

Prepare versions only when the human requests it. Review the complete plan with them, including computed dependent bumps, before running:

```sh
mise run changeset:version
```

This consumes all pending notes, updates package versions and changelogs, and refreshes the pnpm lockfile. It neither commits, tags, nor publishes. Versions remain independent; private workspaces are excluded. Existing changelog history is retained. Land the preparation under the normal commit and review rules, then obtain explicit authorization to publish through the existing GitHub Release workflow. There is no automatically maintained release pull request.

Keep capture, preparation, and publication distinct in commit messages:

- **`release:` is a commit scope reserved for version-only commits**, like `f6be34e release: @pitlane/dev@0.2.0 and @pitlane/theme@0.2.0`. A commit that also changes code or prose takes the scope of what it changes.
- **Never put "release `<package>` `<version>`" in a commit subject** unless the commit is that version-only bump. A subject that claims a release nobody performed costs a reviewer the time it takes to disprove it.

Checking what is actually published beats reasoning about it:

```sh
npm view @pitlane/content versions # what npm has
git ls-remote --tags origin        # what has been tagged
```

#### The umbrella releases by hand

`pitlane` releases only when a pending note names it: `mise run changeset` and pick `pitlane`, or write `"pitlane": minor` into a note. Write one when enough package changes have accumulated to be worth an umbrella upgrade, not after every package release. Its body is the umbrella's changelog entry, so say what the release rolls up.

The umbrella pins every `@pitlane/*` package at `workspace:*`, which `pnpm pack` turns into exact versions, so a release ships whatever versions are current when it is prepared. That also puts it out of range after every package release, and Changesets bumps it each time. `tools/version.ts`, which `changeset:version` runs, undoes that bump unless a note names `pitlane`, and lists the pinned versions in the section of a release that was asked for. `changeset:status` does not know this and lists `pitlane` whenever a package changes.

Both rules live in `.changeset/release.json`. `manual` names the packages that release only on a note. `prerelease` keeps a package on a channel: `{ "pitlane": "alpha" }` turns whatever Changesets computed into the next `alpha.N` and retitles the changelog section to match, so `changeset:status` prints `1.0.0` where preparation writes `1.0.0-alpha.2`. Deleting the entry ends the prerelease at the version Changesets computes.

Tag and release `pitlane@<version>` like any package, **after** the packages it pins. The `publish-pitlane` job waits up to twenty minutes for each pinned version's tarball to answer, so cutting every release in one sitting is safe. It publishes a prerelease to `latest` until a stable `1.0.0` or later exists, and to `next` from then on.

#### A green job is not yet an installable package

`publish.yml` finishing green means npm accepted the publish. It does not mean anyone can install the version yet, and the two halves of the registry catch up in the order that looks most like failure:

| What                                                        | When it caught up       |
| ----------------------------------------------------------- | ----------------------- |
| `npm view <package> version`                                | about a minute          |
| `registry.npmjs.org/@pitlane/<name>/-/<name>-<version>.tgz` | two to six more minutes |

So there is a window, minutes long, where `npm view` names the new version and `npm install` still fails with a 404 on its tarball. All four releases on 2026-09-10 behaved this way. Do not re-cut a tag or re-run the workflow into it.

Read the job log instead of guessing. `+ @pitlane/<name>@<version>` and a `Provenance statement published to transparency log` line mean npm took it, and npm says so itself: `Your package is being processed and may take a few minutes to become available`.

The only check worth trusting is an install, which is what a consumer hits:

```sh
cd "$(mktemp -d)" && npm init -y >/dev/null
npm install @pitlane/<name>@<version>
```

That is also the gate for releasing a dependent. `pnpm pack` writes the resolved version into the dependent's manifest, so `@pitlane/vite-plugin-remix` naming `@pitlane/crawler@^0.2.1` is uninstallable until crawler's own install works.

#### A package's first publish is manual, once

`publish.yml` authenticates through npm Trusted Publishing (OIDC). A trusted publisher cannot be configured for a package that does not exist yet, so the workflow cannot perform a package's **first** publish: it fails with `ENEEDAUTH`, which is not a misconfiguration and not worth debugging. That is the one case where publishing from a laptop is correct.

Cut the tag and the GitHub release first, exactly as always. Then, from the released commit with a clean tree:

```sh
git checkout main && git pull --ff-only
test "$(git rev-parse '@pitlane/<name>@<version>^{commit}')" = "$(git rev-parse HEAD)"   # fails unless the tag points at HEAD

mise run test:<name> && mise run build:<name>   # the gates publish.yml would have run

cd packages/<name>
npm pack --dry-run               # read the file list before it is permanent

npm login --auth-type=web
npm publish --access public --tag latest
```

Two flags earn their place. `--access public` is required because a scoped package defaults to restricted, and the default would publish something nobody can install. `--provenance` is **omitted**: it needs a CI OIDC token, so it fails from a laptop. That first version is the only one without a provenance attestation.

With 2FA set to `auth-and-writes`, `npm publish` opens a second browser approval after `npm login`. Both are interactive, so run them where a person can answer.

Afterwards, configure the trusted publisher on npmjs.com (package settings → Trusted Publisher → GitHub Actions, naming this repo and `publish.yml`). Every later version then goes through the release workflow, with provenance.

A first publish is the slow case: `npm view` itself 404s for several minutes, because the packument is being created rather than invalidated. The install check above is still the gate.

#### Preview builds are not releases

`pkg-preview.yml` publishes an installable build of `@pitlane/assets`, `@pitlane/content`, `@pitlane/crawler`, `@pitlane/data-table-d1`, `@pitlane/theme`, `@pitlane/vite-plugin-fetch-server`, `@pitlane/vite-plugin-remix`, and `pitlane` to [pkg.pr.new](https://pkg.pr.new) on every branch push and pull request. Its job is named `preview` so a green check on a PR cannot be mistaken for a publish; it was called `publish` once, and it was. The npm workflow has no `push` or `pull_request` trigger and cannot run on a PR at all.

Pitlane has exactly two preview mechanisms, and both already run in CI:

| What the change touches | Preview |
| --- | --- |
| A package's behavior | the pkg.pr.new build: `npm i https://pkg.pr.new/pitlane-tools/pitlane/@pitlane/<name>@<sha>` |
| The docs site, or any guide | the Workers preview URL that `preview.yml` comments on the pull request |

Producing the preview therefore means confirming it installs or renders and linking it with what to try — not building a mechanism. A green workflow is not evidence.

Releasing a package that the [templates](https://github.com/pitlane-tools/templates) depend on has one more ordering rule: publish the package first, then merge the companion templates branch. See [`.agents/skills/adopting-packages-into-templates/`](.agents/skills/adopting-packages-into-templates/).

### Package reference docs are generated

Every page under `docs/app/content/api/` is emitted by TypeDoc from the packages' TSDoc comments and is gitignored. The whole TypeDoc setup lives in `.typedoc/`: one config per documented package (`assets.json`, `content.json`, `crawler.json`, `data-table-d1.json`, `theme.json`, `vite-plugin-fetch-server.json`, `vite-plugin-remix.json`), each extending `base.json`, which registers the local theme and router in `plugin.ts`. `mise run docs:api` runs them all through `.typedoc/build.ts`, as one command, because every run merges into the same `docs/.generated/reference*.json` files and a separately invoked run would replay a stale copy of them.

Paths inside those configs resolve relative to the config file, not the repo root, so a package's entry points read `../packages/<name>/src/...` and its output `../docs/app/content/api/<name>`. Adding a documented package means adding a config there plus its name in `CONFIGS` in `.typedoc/build.ts`.

`.typedoc/` is also a workspace package, and that is deliberate. TypeDoc is built on the TypeScript JS compiler API, which TypeScript 7 does not ship — 7 is a Go binary, and TypeDoc's peer range stops at 6.0.x. Its `package.json` therefore holds `typescript` as an alias for `@typescript/typescript6`, while the repo root and every package are on real `typescript@7`. `docs:api` runs from `.typedoc/` so TypeDoc picks up its own copy, and `mise run typecheck` gives it its own `tsc --project .typedoc/tsconfig.json` pass for the same reason. Do not move TypeDoc back to the root: that is what made `typescript` mean 6 repo-wide, which in turn forced a second TypeScript on the packages' declaration build.

Never edit a file under `docs/app/content/api/`; the next build overwrites it. Change the TSDoc comment in `packages/<name>/src/` instead. Narrative documentation belongs in `docs/app/content/guides/`.

### Docs prose linting

Hand-written user-facing docs are linted with [Vale](https://vale.sh) using the [vale-ai-tells](https://github.com/tbhb/vale-ai-tells) style package. Configuration lives in `.vale.ini`; synced styles land in the gitignored `.vale/` directory.

`.omp/extensions/vale-prose.ts` automates this: after every successful `edit`/`write` touching those directories, it reports Vale's findings alongside the tool result, so the agent sees prose feedback immediately. It no-ops until `mise run docs:prose` has downloaded the Vale binary.

**When the extension is inactive (or you are a different agent), run Vale manually after every edit to a page under `docs/app/content/guides/`, `docs/app/content/deployment/`, or `docs/app/content/_partials/`, and fix the findings before committing:**

```sh
vale docs/app/content/guides/styling.md   # one page; mise puts node_modules/.bin on PATH
mise run docs:prose                       # sync styles + lint all user-facing docs
```

If `vale` reports a missing binary, run `mise run docs:prose` at the repo root; it downloads the binary and syncs the styles. Installing dependencies deliberately skips that download — see `allowBuilds` in `pnpm-workspace.yaml`.

Internal documents (`docs/internal/`, `docs/superpowers/`) are exempt, and so is the record: `VISION.md`, `proposals/`, `policies/`, and `decisions/` are not published, so Vale never sees them.

### Hard rules

- **No build-tool wrappers.** Vite, Vitest, Oxfmt, Oxlint, tsdown, TypeDoc and tsc are invoked directly by mise tasks. Do not add ESLint, Prettier, Biome, Vite+, a `scripts` block, or a second task graph in a `vite.config.ts`.
- **Never cut a tag or a release from a feature branch**, and never `npm publish` a version `publish.yml` could have published. The one exception is a package's first publish, above.
- **Never edit a generated page under `docs/app/content/api/`.** Change the TSDoc comment in `packages/<name>/src/`.
- **A package's public surface is a decision.** policy.0007 and policy.0012 govern whether behavior belongs in a new package or an existing one, and the proposal's Package placement section answers both before code exists.
- **Scripts are TypeScript run by Node** (`node tools/validate.ts`), zero dependencies, with `node:test` tests beside them.
- **Every pull request carries a changeset**: a package note when consumers see a difference, an empty one when nothing releasable changed.

## Harness setup

The process lives harness-neutral in `AGENTS.md` and `.agents/`, which stay the source of truth and which no harness forks. Lifecycle wiring is the only harness-specific part, and this repository ships it for [Oh My Pi](https://omp.sh):

| What | How Oh My Pi gets it |
| --- | --- |
| This contract | Loads `AGENTS.md` from the repository root |
| Skills | Discovers `.agents/skills/` |
| Role briefs | `.omp/agents/`, with their models in `.omp/config.yml` |
| `workflow` tool | `.omp/tools/dynamic-workflows/` |
| Before the first turn | `.omp/extensions/prime-beads.ts` runs `bd prime` and injects the work graph and durable memories into the session |
| After every edit | `.omp/extensions/format-after-edit.ts` runs `mise run fmt -- <files>` on each file the `edit` or `write` tool changed and reports a reformat or a parse failure; `.omp/extensions/vale-prose.ts` adds Vale's findings for a published prose page |
| Before the turn ends | `.omp/extensions/check-before-stop.ts` runs `mise run check`; a failure sends the agent back once with the output |

A harness without extensions loses only the convenience, not the rule: `bd prime`, `mise run fmt`, `mise run check`, and `vale` are commands the agent runs itself, and hk's `pre-push` hook and CI run the gate regardless. Another harness wires the same events into its own configuration and commits the result rather than forking `.agents/`.

Git hooks belong to hk, not to a harness: `mise run setup` installs them, and they run for every commit regardless of who or what made it.

## Also binding

- [`.agents/rules/code-quality.md`](.agents/rules/code-quality.md) — what good code looks like here.
- [`.agents/rules/commit-discipline.md`](.agents/rules/commit-discipline.md) — commits, staging, push and pull-request policy.
- [`.agents/rules/enforcement-hierarchy.md`](.agents/rules/enforcement-hierarchy.md) — where a new rule belongs.
- [`.agents/rules/verification.md`](.agents/rules/verification.md) — what evidence a completion claim requires.

### Cross-cutting reasoning skills

- [`.agents/skills/grounding-a-problem/`](.agents/skills/grounding-a-problem/) — learn the problem domain before choosing a solution.
- [`.agents/skills/ontology-review/`](.agents/skills/ontology-review/) — check the conceptual model when important domain concepts change.
- [`.agents/skills/reframing-a-problem/`](.agents/skills/reframing-a-problem/) — challenge the formulation when the current model stops explaining reality.
- [`.agents/skills/systematic-debugging/`](.agents/skills/systematic-debugging/) — find the root cause when the intended behavior is sound and the implementation is wrong.
- [`.agents/skills/tracking-work/`](.agents/skills/tracking-work/) — defer a discovered defect without losing it.

Pitlane's own craft skills: [`.agents/skills/remix/`](.agents/skills/remix/) for the vendored Remix 3 documentation, [`.agents/skills/copyediting/`](.agents/skills/copyediting/) and [`.agents/skills/write-better-prose/`](.agents/skills/write-better-prose/) for published prose.
