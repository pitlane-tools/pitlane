# content-runtime

`@pitlane/content` with no bundler. The loaders read `node:fs` on first access
and `satteri` renders Markdown per request; `remix/assets` serves the one
stylesheet straight from the source tree.

```sh
pnpm --filter pitlane-content-runtime-demo run dev
```

No build step, no `content()`, no `vite-plugin-satteri`, no Vite. The server runs
through `remix/node-tsx`, which is what lets `.tsx` load in plain Node.

Pair it with [`../content-vite`](../content-vite), which serves the same
collections out of a bundle:

```sh
diff demos/content-vite/app/content.ts demos/content-runtime/app/content.ts
```

That diff is empty, which is the whole claim. Here every `.md` and `.mdx` entry
reports its headings, because Sätteri parses the body rather than reading a
compiled module.
