import { createAssetResolver, renderImportMap } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
import { renderToReadableStream } from "preact-render-to-string/stream";
import Root from "../root";

const assets = createAssetResolver(manifest);

// Each route names its own source key so its server-graph stylesheets can be
// observed; observing never turns the route module into a browser entry.
const routes = {
  "/": { source: "src/routes/index.tsx", load: () => import("../routes") },
  "/about": { source: "src/routes/about.tsx", load: () => import("../routes/about") },
  "*": { source: "src/routes/404.tsx", load: () => import("../routes/404") },
};

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // match route and render page
  const match = routes[url.pathname as "/"] ?? routes["*"];
  const content = await (await match.load()).default();
  const clientEntry = await assets.getScriptEntry("src/framework/entry.client.tsx");
  const stylesheets = await assets.getStylesheets([
    "src/framework/entry.client.tsx",
    "src/framework/entry.server.tsx",
    match.source,
  ]);

  // render assets as <head>
  const head = (
    <>
      {stylesheets.map((href) => (
        <link key={href} href={href} rel="stylesheet" />
      ))}
      {clientEntry.preloads.map((href) => (
        <link key={href} href={href} rel="modulepreload" />
      ))}
      <script type="module" src={clientEntry.href}></script>
    </>
  );

  // SSR
  const root = (
    <Root head={head} pathname={url.pathname}>
      {content}
    </Root>
  );
  const html = renderToReadableStream(root);
  const importMapHtml = renderImportMap({ value: clientEntry.importMap });
  return new Response(html.pipeThrough(injectAfterHead(importMapHtml)), {
    headers: { "Content-Type": "text/html;charset=utf-8" },
  });
}

// The import map is spliced in as ordinary server HTML directly after <head>,
// ahead of every module link and script.
function injectAfterHead(markup: string): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let done = markup === "";
  let pending = "";
  return new TransformStream({
    transform(chunk, controller) {
      if (done) return controller.enqueue(chunk);
      pending += decoder.decode(chunk, { stream: true });
      const index = pending.indexOf("<head>");
      if (index === -1) return;
      const at = index + "<head>".length;
      controller.enqueue(encoder.encode(pending.slice(0, at) + markup + pending.slice(at)));
      pending = "";
      done = true;
    },
    flush(controller) {
      if (pending) controller.enqueue(encoder.encode(pending));
    },
  });
}

export default {
  fetch: handler,
};

if (import.meta.hot) {
  import.meta.hot.accept();
}
