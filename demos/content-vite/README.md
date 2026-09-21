# content-vite

`@pitlane/content` with a bundler: `contentLayer()` resolves the collections during the build and inlines them, and `vite-plugin-satteri` compiles the Markdown bodies into the bundle.

```sh
pnpm --filter pitlane-content-vite-demo exec vp build
pnpm --filter pitlane-content-vite-demo exec vp preview
```

Build and preview rather than `vp dev`, because `vp dev` currently fails for every app using `@pitlane/dev`: [#19](https://github.com/pitlane-tools/pitlane/issues/19). That is unrelated to content, and the build path is the one worth seeing here anyway.

Pair it with [`../content-runtime`](../content-runtime), which serves the same collections with no bundler at all. The two demos exist to be compared:

```sh
diff demos/content-vite/app/content.ts demos/content-runtime/app/content.ts
```

That diff is empty. Adding a host edits the Vite config; it never edits a collection.

To see that the content really is in the bundle, delete the source files and serve it again:

```sh
mv app/content /tmp/content-hidden
pnpm --filter pitlane-content-vite-demo exec vp preview   # every page still renders
mv /tmp/content-hidden app/content
```

The one visible difference is on `/blog/hello-markdown`: prebuilt `.md` has no heading list, because `vite-plugin-satteri` emits an HTML string with nowhere to put one. `.mdx` reports headings on both hosts, which is the reason to prefer it for a page that needs a table of contents.
