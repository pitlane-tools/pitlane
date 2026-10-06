import { RPCHandler } from "@orpc/server/fetch";
import {
  QueryClient,
  QueryClientProvider,
  dehydrate,
} from "@tanstack/react-query";
import { renderToReadableStream } from "react-dom/server.edge";
import { App } from "../app";
import { createAssetResolver, renderImportMap } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
import { __rpc_router__ } from "../rpc";
import "./rpc.server";

const rpcHandler = new RPCHandler(__rpc_router__);

// Module-level reads, as upstream merged its query imports at module scope.
const resolver = createAssetResolver(manifest);
const clientEntry = await resolver.getScriptEntry("src/framework/entry.client.tsx");
const assets = {
  js: clientEntry.preloads.map((href) => ({ href })),
  css: (
    await resolver.getStylesheets(["src/framework/entry.client.tsx", "src/app.tsx"])
  ).map((href) => ({ href })),
};
const importMapHtml = renderImportMap({ value: clientEntry.importMap });

async function handler(request: Request): Promise<Response> {
  const rpcResult = await rpcHandler.handle(request, { prefix: "/rpc" });
  if (rpcResult.matched) {
    return rpcResult.response;
  }

  const queryClient = new QueryClient();

  // prefetch query
  await queryClient.ensureQueryData($rpcq.listItems.queryOptions());

  // bootstrap script to hydrate react-query state on the client
  const dehydratedState = dehydrate(queryClient);
  const bootstrapScriptContent = `\
self.__query_client_dehydrated_state=${escapeHtml(JSON.stringify(dehydratedState))};
import(${JSON.stringify(clientEntry.href)});
`;

  function SsrRoot() {
    return (
      <>
        {assets.js.map((attrs) => (
          <link
            {...attrs}
            rel="modulepreload"
            key={attrs.href}
            crossOrigin=""
          />
        ))}
        {assets.css.map((attrs) => (
          <link {...attrs} rel="stylesheet" key={attrs.href} crossOrigin="" />
        ))}
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </>
    );
  }

  const htmlStream = await renderToReadableStream(<SsrRoot />, {
    bootstrapScriptContent,
  });

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

// https://github.com/remix-run/react-router/blob/6ff0bb35db54535b3436375784fd40225a3664c2/packages/react-router/lib/dom/ssr/markup.ts#L15-L20
const ESCAPE_LOOKUP: { [match: string]: string } = {
  "&": "\\u0026",
  ">": "\\u003e",
  "<": "\\u003c",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

const ESCAPE_REGEX = /[&><\u2028\u2029]/g;

function escapeHtml(html: string) {
  return html.replace(ESCAPE_REGEX, (match) => ESCAPE_LOOKUP[match]);
}

export default {
  fetch: handler,
};

if (import.meta.hot) {
  import.meta.hot.accept();
}
