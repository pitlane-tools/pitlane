# content-runtime

`@pitlane/content` with no bundler. The loaders read `node:fs` on first access and `satteri` renders Markdown per request; `remix/assets` serves the one stylesheet straight from the source tree.

```sh
pnpm --filter pitlane-content-runtime-demo run dev     # http://localhost:1613
pnpm --filter pitlane-content-runtime-demo run start   # production
```

No build step, no `contentLayer()`, no `vite-plugin-satteri`, no Vite. The server runs through `remix/node-tsx`, which is what lets `.tsx` load in plain Node.

`start` is that server and nothing else: the asset server minifies and fingerprints, and no watcher, channel, or instrumentation is constructed.

`dev` puts `hmr.ts` in front of it. That process supervises the server, applies an accepted module change in place, restarts it when a change is not accepted, and holds requests until the new generation answers. `remix/ui-hmr/node` and the `uiHmr()` asset loader are what let a component update on both sides without losing its state — edit `app/ui/public/counter.tsx` while the counter reads `clicked 3 times` and it still reads 3 afterwards. Editing a content file is the exception: nothing imports it, so it takes a restart.

Pair it with [`../content-vite`](../content-vite), which serves the same collections out of a bundle:

```sh
diff demos/content-vite/app/content.ts demos/content-runtime/app/content.ts
```

That diff is empty, which is the whole claim. Here every `.md` and `.mdx` entry reports its headings, because Sätteri parses the body rather than reading a compiled module.
