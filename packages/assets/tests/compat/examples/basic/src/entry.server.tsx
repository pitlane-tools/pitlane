import { createAssetResolver, renderImportMap } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";
import { renderToReadableStream } from "react-dom/server.edge";
import { App } from "./App";
import "./index.css";

const assets = createAssetResolver(manifest);

async function handler(_request: Request): Promise<Response> {
    // Read per request, as the upstream example read its query imports per render.
    const entry = await assets.getScriptEntry("src/entry.client.tsx");
    const stylesheets = await assets.getStylesheets(["src/entry.client.tsx", "src/entry.server.tsx"]);

    const html = await renderToReadableStream(
        <Root entry={entry.href} preloads={entry.preloads} stylesheets={stylesheets} />,
    );
    return new Response(html.pipeThrough(injectAfterHead(renderImportMap({ value: entry.importMap }))), {
        headers: { "Content-Type": "text/html;charset=utf-8" },
    });
}

function Root(props: { entry: string; preloads: string[]; stylesheets: string[] }) {
    return (
        <html>
            <head>
                <title>Vite Fullstack</title>
                {props.stylesheets.map(href => (
                    <link key={href} href={href} rel="stylesheet" crossOrigin="" />
                ))}
                {props.preloads.map(href => (
                    <link key={href} href={href} rel="modulepreload" crossOrigin="" />
                ))}
                <script type="module" src={props.entry}></script>
            </head>
            <body>
                <div id="root">
                    <App />
                </div>
            </body>
        </html>
    );
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
