# Images

Status: **research, pre-proposal.** No `@pitlane/images` package exists and none is proposed yet. This records what was learned building an image pipeline by hand while porting [malstrom.me](https://malstrom.me) from Astro 7 to Remix 3 — what was measured, what was built, which parts were wrong, and which alternatives were ruled out. Claims marked _measured_ were verified against a running system; claims marked _assumed_ were not.

## Where this came from

The Astro implementation of that site used `astro:assets` throughout. Remix 3 has no equivalent, so the port hand-rolled one: a `/_image` route over the Cloudflare Workers `IMAGES` binding, a URL builder, request validation, and runtime measurement of source-image dimensions. It works, and two of its four pieces turned out to be a mistake. The exercise is worth keeping because this is the package that should have existed.

## What Astro actually provides

Three things, and they are separable:

| Piece | What it does |
| --- | --- |
| `<Image>` / `<Picture>` | responsive markup — `srcset`, `sizes`, intrinsic `width`/`height`, `loading` |
| `getImage()` | one-off derivative for a known size and format |
| `image()` schema helper | typed frontmatter: validates the path resolves, carries dimensions into the entry |

On Cloudflare, `adapter: cloudflare({ imageService: "cloudflare-binding" })` routes all of it through an app-hosted endpoint backed by the Workers `IMAGES` binding. _Measured_ on the deployed site:

```
og:image → /_image?href=%2F_astro%2Fheadshot.DijDoIUb.webp&w=1200&h=773&q=80&f=jpeg
        → 200  image/jpeg  111 KB
```

That URL shape matters below.

Worth noting how little of it that site used. Across ~3,500 lines of content and components, only three call sites actually resized: the Open Graph card (1200w JPEG), the About headshot (640w), and carousel entries (`height: 640`). A fourth converted format only. Everything else passed source images through untouched. A package sized for the general case would have been mostly unused.

## The three Cloudflare transform surfaces

|  | Surface | State on that zone |
| --- | --- | --- |
| 1 | `/cdn-cgi/image/…` zone URL API | _measured:_ **404** — the per-zone Transformations toggle is not enabled |
| 2 | `env.IMAGES` binding inside an app route | _measured:_ **working in production** |
| 3 | Cloudflare Images storage (`imagedelivery.net`) | different product; stores as well as transforms |

1 and 2 are two interfaces to the same transformation engine. _Assumed, not verified:_ they bill against the same transformations meter. If that holds, "image transformation for free with Astro" is free of _code_, not of billing — the adapter ships the endpoint, the account still pays for the transforms.

The practical consequence is that **1 has no local emulation and 2 does.** `wrangler dev` does not serve `/cdn-cgi/image/`; miniflare does emulate the `IMAGES` binding, and produced real JPEGs locally. Any design whose URLs point at a zone-level CDN path breaks `dev` by construction. An app-hosted route does not. That asymmetry should drive the default.

## What the port built, and which half was wrong

| Piece | Verdict |
| --- | --- |
| `GET /_image` over the binding | keep — this is the transform |
| Request validation (prefix allowlist, dimension caps, format allowlist) | keep — it guards a public endpoint |
| URL builder | keep, but it is a provider in disguise (see below) |
| Runtime intrinsic-dimension measurement via `env.IMAGES.info()`, memoized per isolate | **wrong** — it produced both defects below |

The dimension measurement existed only to fill `og:image:width` / `og:image:height` while preserving the source aspect ratio. It put I/O on the render path of every page, and cost two real defects.

**Defect 1 — a memoized rejected promise.** The cache stored the pending promise before awaiting and never evicted on rejection, so one transient binding failure on the site-default share image would make every server-rendered page throw for the isolate's lifetime — including the 500 page, which also built a share card. Lesson: never cache a promise without evicting it on rejection, and keep the blast radius of transform I/O inside the transform endpoint, where a failure is one broken image rather than a dead document.

**Defect 2 — `ASSETS.fetch` is host-sensitive in dev only.** Reading source bytes needs an absolute URL. A placeholder host (`http://assets.invalid`) worked deployed _and_ under `vite preview`, and returned **403 for every request** under `vite dev`. _Measured_ from inside the Worker:

| URL handed to `ASSETS.fetch`                 | dev |
| -------------------------------------------- | --- |
| `http://assets.invalid/images/headshot.webp` | 403 |
| `http://localhost/images/headshot.webp`      | 200 |

Deployed, the binding ignores the host. In dev it is backed by the Vite dev server, which rejects a host it does not recognise. `@cloudflare/vite-plugin`'s own dev asset worker uses `http://localhost` for the same purpose (`UNKNOWN_HOST` in `dist/workers/asset-worker/index.js`), so that is the host to use. Lesson: `dev`, `preview`, and deployed are three separate surfaces for bindings, and passing two of them says nothing about the third.

## unpic supplies the half worth not writing

[unpic](https://unpic.pics) is a URL translator plus a responsive-markup layer. It does **not** transform images — in its own words, it exists so a framework can "transform the URL to use the original image CDN" rather than re-process bytes. So it complements a transform endpoint instead of replacing one.

`@unpic/core@1.0.3`'s `./base` subpath is framework-agnostic and injects the transformer: `transformBaseImageProps`, `getSrcSet`, `getSizes`, `getStyle`, `getBreakpoints`, `transformSharedProps`. Given `width`/`height` it returns a complete `<img>` attribute bag: `src`, `srcset`, `sizes`, `style`, dimensions, `loading`, `fetchpriority`, `decoding`, and `role="presentation"` on empty `alt`.

The decisive find is unpic's **`astro` provider**, which is a provider for an app-hosted route rather than a CDN:

```ts
const DEFAULT_ENDPOINT = "/_image";
keyMap: { format: "f", width: "w", height: "h", quality: "q" },
defaults: { fit: "cover" },
url.searchParams.set("href", src.toString());
```

That is byte-for-byte the URL shape the deployed Astro site emits, and the port had independently arrived at the same `w`/`h`/`f`/`q` parameter names with a `src` key instead of `href`. So the hand-rolled URL builder was an unpic provider all along, and a `pitlane` provider is that file with one parameter renamed. `unpic@4.2.2` also ships `netlify`, `vercel`, `nextjs`, and `ipx` providers of the same app-hosted shape — the pattern is established, not novel.

## remix/ui integration facts

_Measured_ against `@remix-run/ui@0.8.0`. These are the wrapper's whole surface area:

| Finding | Consequence |
| --- | --- |
| `Trackable<T> = T` — an identity alias (`runtime/dom.d.ts:44`) | `JSX.IntrinsicHTMLElements["img"]` satisfies unpic's `CoreImageAttributes` constraint with no adapter type |
| `srcSet?: Trackable<string \| undefined>` | unpic emits `srcset`; one rename needed |
| Both `fetchpriority` and `fetchPriority` accepted | no rename needed |
| `StyleProps extends AllStyleProperties` with `[key: string]` (`style/style.d.ts`) | unpic's kebab-case `object-fit` / `aspect-ratio` / `max-width` keys type _and_ serialize correctly |

Net: the `remix/ui` wrapper is **smaller than `@unpic/react`'s**, which needs a whole `camelize.ts` because React style objects are camelCase and React renames two attributes. Here it is one rename and a spread, about 25 lines.

One typing trap: `Omit<UnpicBaseImageProps<…>, "transformer">` collapses the `fixed | constrained | fullWidth` dimension union. The omit has to distribute (`T extends unknown ? Omit<T, K> : never`) or callers lose the layout-specific dimension requirements.

A second interaction worth checking before shipping: unpic's `getStyle` emits inline styles for `constrained` and `fullWidth`, and sets no `width`/`height` attributes for those layouts because the inline `aspect-ratio` carries CLS protection instead. An app whose CSS already styles content images — border-radius, outline, `margin-inline: auto` — may need `unstyled: true`, and then owns aspect ratio itself. `layout: "fixed"` sidesteps both.

## Where the package boundary belongs

The split that makes this work:

- **Package owns** the component, the props layer, and the transformer contract.
- **Application owns** the transform endpoint and its platform binding.

Injecting the transformer is what keeps the endpoint swappable — app-hosted route today, `/cdn-cgi/image/` or a CDN later, with no change above the seam. Conforming to unpic's existing `TransformerFunction` shape rather than inventing one also means the package can be pointed at any of unpic's 20-odd providers for free, and that a `pitlane` provider could be upstreamed as a small PR against a file already being mirrored.

## Open questions

1. **Dimensions.** unpic requires `width` + `height`, or one plus `aspectRatio`. Component call sites can supply them; Markdown `![]()` bodies cannot. `@unpic/pixels@1.3.0` reads dimensions from bytes at build time — does the manifest become checked-in codegen, or a virtual module only? This is the single largest unresolved piece.
2. **Does the package ship the endpoint?** Astro's adapter does. Shipping a route means shipping platform code (`IMAGES`, `ASSETS`, source-byte reading) and a security surface; shipping only the client contract keeps the package platform-free but leaves every app to write the same ~55 lines and re-derive the `ASSETS.fetch` host lesson above.
3. **Share-card shape.** Preserving the source aspect ratio requires knowing source dimensions, which is what forced render-time I/O. A fixed 1200×630 `fit=cover` card makes the dimensions compile-time constants and removes that failure class entirely, at the cost of cropping unfurls to 1.91:1. Worth deciding once, centrally.
4. **`@pitlane/content` interaction.** Astro's `image()` schema helper validates that a frontmatter path resolves and carries dimensions into the entry. That is the natural home for question 1, and it is a content-layer feature as much as an images one.
5. **Provider naming.** A consumer could point the wrapper at `unpic/providers/astro` verbatim by naming its query parameter `href`. It works, and importing a module called `astro` into a Remix 3 app is a trap for the next reader. Owning the shape is probably worth 12 lines.

## Lessons to carry regardless of what gets built

- Keep rendering I/O-free. Transform I/O belongs behind the endpoint, where failure degrades one image instead of the document.
- Never memoize a promise without evicting it on rejection.
- Verify `dev`, `preview`, and deployed independently. Platform bindings behave differently on each, and the gap between two of them is where both defects above lived.
- Prefer an app-hosted transform route over CDN-path URLs for anything that has to work locally.
