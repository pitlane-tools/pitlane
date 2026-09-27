# Documentation development

`docs/` is a Remix application built with Pitlane and published as Cloudflare static assets. Its content lives under `docs/app/content/`: guides in `guides/`, deployment pages in `deployment/`, the generated API reference in `api/`, and shared authoring inputs in `_partials/`. `docs/app/content.ts` declares the collections. `docs/internal/` and `docs/superpowers/` are not part of any collection, so nothing publishes or indexes them.

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

`docs:build` builds the reader's workspace dependencies, compiles content, checks MDX, and prerenders the public documents. `docs:serve` serves the published assets through Cloudflare's local runtime. `docs:test` builds the reader and exercises static delivery, redirects, content, and genuine 404s. `check` runs the repository's remaining gates too.

The homepage is the Remix route `/`, rendered from `docs/app/home/page.tsx` into `index.html` by the same build as the documentation. Its palette, logos, and code examples follow the system light/dark preference without JavaScript. The package inspector uses native radio controls, so examples remain selectable without JavaScript. The circuit animation and lap-clock sequence are illustrative; they do not report package performance. They run automatically while visible, stop when reduced motion is enabled, and have no playback controls. The active command shows the running cumulative timestamp, which freezes when that command completes while the next row continues timing. At completion, the clock holds the result with the total row in red before restarting. The visual reference is the [engineers’ pit-wall monitors](https://f1ingenerale.com/english-post/f1-exclusive-what-engineers-see-on-pit-wall-monitors-strategy-ferrari-red-bull-data-computer/), interpreted through real package examples and deployment links.

The circuit drawing adapts [Mosport-CTMP.svg](https://upload.wikimedia.org/wikipedia/commons/5/51/Mosport-CTMP.svg), a CC0 diagram by Will Pittenger, for Canadian Tire Motorsport Park's Grand Prix layout. The circuit and pit lane use the same uniform scale. Actual turn labels replace invented timing-sector boundaries; the car positions and 16-second lap remain a demonstration, not race data.

The homepage uses the reader's shared header, surfaces, borders, and corner radii, with self-hosted Instrument Sans for its display headings. `docs/app/theme.ts` holds paired light and dark variants of five brand colors: racing red, indigo velvet, medium slate blue, amber flame, and royal gold. Red remains primary in both appearances, with a moderately softened dark variant and a red lap-clock readout. Indigo and blue provide secondary accents for monitor labels, track annotations, and completed sectors in both modes. Gold and amber are tertiary accents on the track's start/finish and direction markers and in warning callouts. Semantic roles follow the system appearance without JavaScript across the homepage, guides, and API reference.

The package selector presents tabs without radio circles. With JavaScript, it exposes a tablist with one selected tab and associated panel; arrow keys follow its vertical desktop or horizontal mobile orientation, and Home/End jump to the first/last package. The mobile tab row scrolls the focused choice fully into view. Without JavaScript, visually hidden native radios retain selection and keyboard behavior in a stacked layout. Enhancement preserves an existing choice and its focus.

The inspector reserves the tallest package panel's height at each viewport width so switching tabs does not move the sections below it. The homepage wordmark starts enlarged on the same left edge as the hero copy, then docks into the shared navigation as the page scrolls. Reduced motion leaves static hero and navigation logos instead. Search precedes the primary navigation, whose links keep the same position across the homepage and documentation.

## Author Markdown and MDX

Use Markdown for plain prose and fenced examples. Use MDX for pages that compose documentation components. Import components explicitly from `docs/app/components/documentation.tsx`, following existing guides. Shared MDX partials are rendered through `Include`; they are authoring inputs, not public pages.

Prepare installation examples at MDX module scope, then pass them to the real `InstallGroup` component. The async helper accepts ordinary JavaScript values, including imported package lists:

```mdx
import { InstallGroup } from "../../components/documentation.tsx";
import { installAlternatives } from "../../install.ts";

export const installation = await installAlternatives({ dev: ["@pitlane/dev"] });

<InstallGroup alternatives={installation} />
```

Remix renders components synchronously. Module-level `await` finishes while the build or development server imports the document; the component receives prepared markup. Keep async preparation outside rendered JSX expressions.

A guide with Vite and No Build variants keeps separate URLs and declares its variant in `build` frontmatter. Shared content can use `Vite` and `NoBuild` inside that declared context. Frontmatter is validated by the content collection.

Heading destinations must be unique within each rendered page, including its shared partials. The build reports the page and conflicting anchor if composition creates a duplicate. Rename the colliding heading or remove the repeated include; headings in mutually exclusive build variants do not conflict.

Fenced examples are displayed source. They are not executable MDX and are not typechecked by the MDX checker. Executable expressions use JavaScript; use JSDoc for document-local types and imported TypeScript modules for substantial logic.

Fenced examples, installation commands, and generated reference examples all use Expressive Code. Highlighting belongs to compilation; its shared stylesheet and supported copy script are emitted through Vite. GitHub Light and GitHub Dark follow the system color scheme, and code uses the self-hosted JetBrains Mono variable font. Keep displayed code, copied text, and Markdown exports consistent.

Package-manager commands use labeled native `<details>` disclosures. Every alternative is accessible without JavaScript. Remix enhances the disclosures to remember and synchronize the chosen manager using `pitlane-package-manager` in localStorage. The build-mode switch remains ordinary links to separate Vite and No Build documents; enhancement remembers future guide-navigation choices in `pitlane-build-mode`, but never overrides an explicit URL. Unavailable storage disables persistence, not reading or current-session selection.

The browser preserves valid existing stored choices and migrates a valid old same-named cookie only when no valid stored choice exists. It does not migrate appearance. Cookie access restrictions must not prevent hydration; if cookie retirement fails, a valid stored choice still wins on the next visit.

A narrow early script restores each disclosure before its command is parsed, preventing the default command from appearing while a slow response streams. Subsequent interactions belong to Remix components and lifecycle-scoped state. Do not add a second DOM-scanning application, custom code-copy controller, or server preference endpoint.

## Editor and command-line diagnostics

Install the recommended **MDX** VS Code extension (`unifiedjs.vscode-mdx`). Open the repository workspace so its checked-in settings and `docs/tsconfig.json` apply. The workspace selects `.mdx/node_modules/typescript/lib` for the editor integration; `.mdx/` pins MDX language server 0.6.4 with TypeScript 6.0.3. Repository and package checks remain on TypeScript 7.

Executable MDX supports component-prop diagnostics, expression checks, completion, hover, and definition navigation. Imports resolve to real Remix component types. Unknown components must be imported rather than added to a permissive global declaration.

```sh
mise run docs:mdx
```

This command checks diagnostic fixtures, then visits every included authored MDX page and partial, including unreferenced partials. Failures report the originating file, line, and column. The fixture check requires invalid props, unresolved imports, invalid expressions, unknown components, and syntax errors to remain detectable.

Do not format MDX with the repository's Markdown formatter. Oxfmt currently changes executable MDX syntax; `.oxfmtrc.jsonc` excludes it and workspace MDX format-on-save is disabled. Vale still checks published MDX prose.

## Reference and deployment

API reference is generated from package exports and TSDoc by `.typedoc/`, which has its own TypeScript 6 dependency. Never edit `docs/app/content/api/` output. Change the originating TSDoc instead.

The build keeps a Node server renderer in `docs/dist/ssr/` for development and publication and emits complete public HTML with the browser assets in `docs/dist/client/`. Production and branch previews use the root `wrangler.jsonc` to serve those assets, with native canonical redirects and a static 404. There is no deployed application entry, request-time document renderer, personalized response HTML, or cookie-dependent cache policy.

Guides and deployment pages compile to Remix components. Generated reference pages compile to HTML strings with their headings, permalinks, and old module anchors in place. The same application shell renders every document at build time: symbol and guide pages as `<path>.html`, module overviews as `<path>/index.html`. Explicit Vite and No Build documents contain only their own resolved content, metadata, outline, search entry, and Markdown export.

Native Remix navigation retrieves these complete static documents and reconciles the shell and article together. Reference bodies remain build-generated HTML rather than a hydrated article-sized component. Application controls use Remix components, event mixins, and lifecycle-scoped effects; Expressive Code's third-party copying runtime is the deliberate exception.

`docs:test` checks published document delivery and invariance under all supported legacy preference-cookie combinations. CSS, scripts, search indexes, Markdown exports, the sitemap, and LLM indexes are built from the same publication. The homepage and documentation now share a single Remix application and static publishing pipeline. Publishing a branch preview does not authorize a production deployment.
