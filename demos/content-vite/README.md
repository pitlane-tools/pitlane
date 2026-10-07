# content-vite

`@pitlane/content` with a bundler: `contentLayer()` resolves the collections during the build and inlines them, and `vite-plugin-satteri` compiles the Markdown bodies into the bundle.

```sh
pnpm --filter pitlane-content-vite-demo run dev       # dev server
pnpm --filter pitlane-content-vite-demo run build
pnpm --filter pitlane-content-vite-demo run preview
```

The scripts run `vp`, which loads Vite+ core. Every `vite` in this workspace is aliased to that same core, so the dev server and `@pitlane/vite-plugin-remix` share one copy of Vite. The build path is the one worth seeing here.

Pair it with [`../content-runtime`](../content-runtime), which serves the same collections with no bundler at all. The two demos exist to be compared:

```sh
diff demos/content-vite/app/content.ts demos/content-runtime/app/content.ts
```

That diff is empty. Adding a host edits the Vite config; it never edits a collection.

To see that the content really is in the bundle, delete the source files and serve it again:

```sh
mv app/content /tmp/content-hidden
pnpm --filter pitlane-content-vite-demo run preview   # every page still renders
mv /tmp/content-hidden app/content
```

The one visible difference is on `/blog/hello-markdown`: prebuilt `.md` has no heading list, because `vite-plugin-satteri` emits an HTML string with nowhere to put one. `.mdx` reports headings on both hosts, which is the reason to prefer it for a page that needs a table of contents.
