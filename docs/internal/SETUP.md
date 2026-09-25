# Documentation development

The reader in `.docs/` is a Remix application built with Pitlane and Cloudflare's Vite integration. Guides live in `docs/guides/`, deployment pages in `docs/deploy/`, and shared authoring inputs in `docs/_partials/`. `docs/internal/` is excluded from publication and search.

## Run the reader

Install the tool versions in `mise.toml`, then run these commands from the repository root:

```sh
mise install
pnpm install --frozen-lockfile
mise run docs:dev
```

`docs:dev` builds the publication assets, then starts Vite on port 1337. Open `http://localhost:1337/guides/vite-plugin`. Application and content edits go through Vite; search and downloadable Markdown use the last build's static assets. Rerun `mise run docs:build` to refresh those assets, or `mise run docs:api` after changing a package's TSDoc.

```sh
mise run docs:build
mise run docs:serve
mise run docs:test
mise run check
```

`docs:build` builds the reader's workspace dependencies, compiles content, checks MDX, and generates publication assets. `docs:serve` runs the built application through the Cloudflare preview runtime. `docs:test` builds the reader and exercises its HTTP contract in a local Worker. `check` runs the repository's remaining gates too.

The home page still uses its existing VitePress implementation in branch previews. Its separate port is a production-launch gate: do not merge this documentation migration into the production branch until that work is complete.

## Author Markdown and MDX

Use Markdown for plain prose and fenced examples. Use MDX for pages that compose documentation components. Import components explicitly from `.docs/app/components/documentation.tsx`, following existing guides. Shared MDX partials are rendered through `Include`; they are authoring inputs, not public pages.

A guide with Vite and No Build variants keeps separate URLs and declares its variant in `build` frontmatter. Shared content can use `Vite` and `NoBuild` inside that declared context. Frontmatter is validated by the content collection.

Heading destinations must be unique within each rendered page, including its shared partials. The build reports the page and conflicting anchor if composition creates a duplicate. Rename the colliding heading or remove the repeated include; headings in mutually exclusive build variants do not conflict.

Fenced examples are displayed source. They are not executable MDX and are not typechecked by the MDX checker. Executable expressions use JavaScript; use JSDoc for document-local types and imported TypeScript modules for substantial logic.

## Editor and command-line diagnostics

Install the recommended **MDX** VS Code extension (`unifiedjs.vscode-mdx`). Open the repository workspace so its checked-in settings and `docs/tsconfig.json` apply. The workspace selects `.mdx/node_modules/typescript/lib` for the editor integration; `.mdx/` pins MDX language server 0.6.4 with TypeScript 6.0.3. Repository and package checks remain on TypeScript 7.

Executable MDX supports component-prop diagnostics, expression checks, completion, hover, and definition navigation. Imports resolve to real Remix component types. Unknown components must be imported rather than added to a permissive global declaration.

```sh
mise run docs:mdx
```

This command checks diagnostic fixtures, then visits every included authored MDX page and partial, including unreferenced partials. Failures report the originating file, line, and column. The fixture check requires invalid props, unresolved imports, invalid expressions, unknown components, and syntax errors to remain detectable.

Do not format MDX with the repository's Markdown formatter. Oxfmt currently changes executable MDX syntax; `.oxfmtrc.jsonc` excludes it and workspace MDX format-on-save is disabled. Vale still checks published MDX prose.

## Reference and deployment

API reference is generated from package exports and TSDoc by `.typedoc/`, which has its own TypeScript 6 dependency. Never edit `docs/package/` output. Change the originating TSDoc instead.

The build emits one application in `.docs/dist/ssr/` and static assets in `.docs/dist/client/`. Deployment and HTTP checks use `.docs/dist/ssr/wrangler.json`, generated from the root Cloudflare configuration. Content compilation, highlighting, and complete API reference pages belong to the build. Guide and deployment page HTML is rendered on requests.

Guides and deployment pages compile to Remix components. Generated reference pages compile to HTML strings instead, with their headings, permalinks, and old module anchors in place and every example rendered by Expressive Code. Rendering inserts that HTML into the article as it is, so reference examples need no Remix hydration. Expressive Code's shared stylesheet and copy script are emitted through Vite. Its GitHub Light and GitHub Dark themes follow the system color scheme; code uses the self-hosted JetBrains Mono variable font.

The build renders every reference page through the built application, the same way a request would, and publishes the complete document at its canonical address: a symbol page as `<path>.html`, a module overview as `<path>/index.html`. Cloudflare's default HTML handling serves each one without running the Worker and redirects the other trailing-slash spelling to it. A reference page may be static only because no reader preference changes it; `docs:test` compares every reference page against every supported preference combination. Guides and deployment pages depend on preference cookies, so no static HTML is published for them and their responses use private, non-shared caching.

Reference pages, CSS, scripts, search indexes, and Markdown exports are static assets. A reader's old build-mode or package-manager choice in localStorage can only migrate after JavaScript runs; the first server response cannot read browser storage. The Remix reader follows the operating system's color scheme, with no appearance preference; an old stored appearance choice is ignored. The existing VitePress site is unchanged.
