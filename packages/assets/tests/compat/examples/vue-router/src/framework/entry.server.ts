import { createAssetResolver, renderImportMap } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
import { createHead, transformHtmlTemplate } from "unhead/server";
import { createSSRApp } from "vue";
import { RouterView, createMemoryHistory, createRouter } from "vue-router";
import { renderToString } from "vue/server-renderer";
import { routes } from "../routes";

const resolver = createAssetResolver(manifest);
const clientEntryKey = "src/framework/entry.client.ts";

async function handler(request: Request): Promise<Response> {
  // setup app
  const app = createSSRApp(RouterView);

  // setup vue-router
  // https://github.com/nuxt/nuxt/blob/766806c8d90015873f86c3f103b09803bd214258/packages/nuxt/src/pages/runtime/plugins/router.ts
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  });
  app.use(router);

  const url = new URL(request.url);
  const href = url.href.slice(url.origin.length);
  await router.push(href);
  await router.isReady();

  // collect assets from current route
  const sources = router.currentRoute.value.matched
    .map((to) => to.meta.source)
    .filter((source): source is string => typeof source === "string");
  const clientEntry = await resolver.getScriptEntry("src/framework/entry.client.ts");
  const preloads = await resolver.getPreloads([clientEntryKey, ...sources]);
  const stylesheets = await resolver.getStylesheets([clientEntryKey, ...sources]);
  const head = createHead();
  head.push({
    link: [
      ...stylesheets.map((href) => ({ rel: "stylesheet", href })),
      ...preloads.map((href) => ({ rel: "modulepreload" as const, href })),
    ],
    script: [{ type: "module", src: clientEntry.href }],
  });

  // SSR
  const ssrStream = await renderToString(app);

  // inject to HTML shell with head tags
  let htmlStream = `\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vue Router Custom Framework</title>
</head>
<body>
  <div id="root">${ssrStream}</div>
</body>
</html>
`;
  htmlStream = await transformHtmlTemplate(head, htmlStream);
  // The import map leads the head, after unhead has placed its tags, so it
  // precedes every modulepreload link and module script.
  htmlStream = htmlStream.replace(
    "<head>",
    () => "<head>" + renderImportMap({ value: clientEntry.importMap }),
  );

  return new Response(htmlStream, {
    headers: {
      "Content-Type": "text/html;charset=utf-8",
    },
  });
}

export default {
  fetch: handler,
};

if (import.meta.hot) {
  import.meta.hot.accept();
}
