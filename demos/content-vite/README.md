# content-vite

`@pitlane/content` with a bundler: `contentLayer()` resolves the collections during the build and inlines them, and `vite-plugin-satteri` compiles the Markdown bodies into the bundle.

```sh
pnpm --filter pitlane-content-vite-demo run dev       # dev server
pnpm --filter pitlane-content-vite-demo run build
pnpm --filter pitlane-content-vite-demo run preview
```

The scripts run the demo's own Vite rather than the copy `vp dev` bundles. `@hiogawa/vite-plugin-fullstack`, which `@pitlane/dev` builds on, checks the dev environment against its own Vite's classes, so a server created by a second copy fails its `isRunnableDevEnvironment` assertion. The build path is still the one worth seeing here.

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
