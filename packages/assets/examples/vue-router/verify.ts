// Renders each route through the built server entry, with no HTTP server, and
// checks that every asset URL the documents name is a hashed file the client
// build wrote. Run it after `npm run build`.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

interface Document {
    importMap: Record<string, string>;
    scripts: string[];
    preloads: string[];
    stylesheets: string[];
}

let root = import.meta.dirname;
let clientRoot = join(root, "dist/client");
// A runtime path, not a static import: the build output does not exist when
// `tsc` checks this file, and it is not part of the source graph.
let server: { default: { fetch(request: Request): Promise<Response> } } = await import(
    pathToFileURL(join(root, "dist/ssr/index.js")).href
);

function assertPublished(href: string) {
    assert.match(href, /^\/assets\/.+-[\w-]{8}\.(js|css)$/, `${href} is a hashed build file`);
    assert.ok(existsSync(join(clientRoot, href)), `${href} exists in dist/client`);
}

async function render(path: string): Promise<Document> {
    let response = await server.default.fetch(new Request(new URL(path, "http://localhost")));
    assert.equal(response.status, 200, `${path} renders`);
    let text = await response.text();

    let mapStart = text.indexOf('<script type="importmap">');
    let firstModule = text.search(/<link rel="modulepreload"|<script type="module"/);
    assert.ok(mapStart !== -1, `${path} delivers an import map`);
    assert.ok(mapStart < firstModule, `${path} delivers the import map before any module`);
    let mapJson = text.slice(text.indexOf(">", mapStart) + 1, text.indexOf("</script>", mapStart));
    let { imports: importMap }: { imports: Record<string, string> } = JSON.parse(mapJson);

    let document: Document = { importMap, scripts: [], preloads: [], stylesheets: [] };
    for (let [tag] of text.matchAll(/<(?:script|link)\b[^>]*>/g)) {
        let { type, rel, src, href } = Object.fromEntries(
            [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]),
        );
        if (type === "module") document.scripts.push(src!);
        if (rel === "modulepreload") document.preloads.push(href!);
        if (rel === "stylesheet") document.stylesheets.push(href!);
    }
    for (let href of [
        ...document.scripts,
        ...document.preloads,
        ...document.stylesheets,
        ...Object.values(importMap),
    ]) {
        assertPublished(href);
    }
    assert.equal(document.scripts.length, 1, `${path} boots one module script`);
    assert.ok(document.preloads.includes(document.scripts[0]!), `${path} preloads its entry`);
    return document;
}

let home = await render("/");
let about = await render("/about");
let faq = await render("/faq");

let notFound = await server.default.fetch(new Request("http://localhost/missing"));
assert.equal(notFound.status, 404, "an unmatched path is a 404");

assert.ok(Object.keys(home.importMap).length > 0, "the import map has entries");

// Only the about page imports about.css, so only its document links it.
let aboutStyles = about.stylesheets.filter(href => !home.stylesheets.includes(href));
assert.ok(aboutStyles.length > 0, "/about links a stylesheet / does not");
assert.ok(
    aboutStyles.every(href => !faq.stylesheets.includes(href)),
    "/faq does not link the about stylesheet",
);

// Each page is a lazy route: its chunk is preloaded on its own route only.
let pageChunk = (page: Document, ...others: Document[]) => {
    let own = page.preloads.filter(href => others.every(other => !other.preloads.includes(href)));
    assert.equal(own.length, 1, `exactly one preload is specific to the page: ${own}`);
    return own[0]!;
};
let pages = {
    "/": pageChunk(home, about, faq),
    "/about": pageChunk(about, home, faq),
    "/faq": pageChunk(faq, home, about),
};

// Vapor compiles a template to an HTML string that its runtime clones, where a
// VDOM render function builds `<h1>` with a call.
for (let [path, href] of Object.entries(pages)) {
    let code = readFileSync(join(clientRoot, href), "utf8");
    assert.match(code, /<main[^<]*<h1/, `${path}'s client chunk holds an HTML template`);
}

// The unminified server build keeps the compiler's own mode marker,
// `__vapor: true`, in the `//#region <source>` Rolldown writes for each SFC.
let serverRoot = join(root, "dist/ssr");
let vapor: Record<string, boolean> = {};
for (let file of readdirSync(serverRoot, { recursive: true, encoding: "utf8" })) {
    if (!file.endsWith(".js")) continue;
    for (let region of readFileSync(join(serverRoot, file), "utf8").split("//#region ").slice(1)) {
        let source = region.slice(0, region.search(/[?\n]/));
        if (!source.endsWith(".vue")) continue;
        vapor[source] = (vapor[source] ?? false) || region.includes("__vapor: true");
    }
}
assert.deepEqual(vapor, {
    "src/layout.vue": false,
    "src/pages/about.vue": true,
    "src/pages/faq.vue": true,
    "src/pages/index.vue": true,
});

console.log(
    JSON.stringify(
        {
            pages,
            vapor,
            home,
            about: { ...about, importMap: undefined },
            faq: { ...faq, importMap: undefined },
        },
        undefined,
        4,
    ),
);
