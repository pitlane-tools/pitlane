import { createAssetResolver, renderImportMap } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
import { renderToReadableStream } from "react-dom/server.edge";
import {
  StaticRouterProvider,
  createStaticHandler,
  createStaticRouter,
} from "react-router";
import { routes } from "./routes";

const { query, dataRoutes } = createStaticHandler(routes);
const resolver = createAssetResolver(manifest);
const clientEntryKey = "src/framework/entry.client.tsx";

async function handler(request: Request): Promise<Response> {
  const queryResult = await query(request);

  if (queryResult instanceof Response) {
    return queryResult;
  }

  const context = queryResult;
  const router = createStaticRouter(dataRoutes, context);

  // collect assets from matched routes only, through observation methods:
  // matched route modules are never registered as browser entries here.
  const sources: string[] = context.matches
    .map((m) => m.route.handle?.source)
    .filter((source): source is string => typeof source === "string");
  const clientEntry = await resolver.getScriptEntry("src/framework/entry.client.tsx");
  const preloads = await resolver.getPreloads([clientEntryKey, ...sources]);
  const stylesheets = await resolver.getStylesheets([clientEntryKey, ...sources]);

  function SsrRoot() {
    return (
      <>
        {preloads.map((href) => (
          <link href={href} rel="modulepreload" key={href} crossOrigin="" />
        ))}
        {stylesheets.map((href) => (
          <link href={href} rel="stylesheet" key={href} crossOrigin="" />
        ))}
        <StaticRouterProvider router={router} context={context} />
      </>
    );
  }

  const htmlStream = await renderToReadableStream(<SsrRoot />, {
    bootstrapScriptContent: `import(${JSON.stringify(clientEntry.href)})`,
  });
  const importMapHtml = renderImportMap({ value: clientEntry.importMap });

  return new Response(htmlStream.pipeThrough(injectAfterHead(importMapHtml)), {
    headers: {
      "Content-Type": "text/html;charset=utf-8",
    },
  });
}

// React owns the document, so the import map is spliced in as ordinary
// server HTML directly after <head>, ahead of every module link and script.
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
