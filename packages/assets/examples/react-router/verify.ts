// Renders each route through the built server entry, without an HTTP server,
// and checks that every asset URL the document names is a hashed file the
// client build wrote. Run it after `npm run build`.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

assert.throws(
    () => import.meta.resolve("remix"),
    "remix must not be installed beside this example",
);

interface FetchHandler {
    fetch(request: Request): Promise<Response>;
}

interface Document {
    importMap: Record<string, string>;
    scripts: string[];
    preloads: string[];
    stylesheets: string[];
}

let root = import.meta.dirname;
let clientDir = join(root, "dist/client");
// A computed specifier: the built entry does not exist when `tsc` checks this file.
let built: { default: FetchHandler } = await import(
    pathToFileURL(join(root, "dist/ssr/index.js")).href
);
let server = built.default;

function attributes(tag: string): Record<string, string> {
    let found: Record<string, string> = {};
    for (let [, name, value] of tag.matchAll(/([\w-]+)="([^"]*)"/g)) found[name!] = value!;
    return found;
}

function assertPublished(href: string) {
    assert.match(href, /^\/assets\/.+-[\w-]{8}\.(js|css)$/, `${href} is a hashed build file`);
    assert.ok(existsSync(join(clientDir, href)), `${href} exists in dist/client`);
}

async function render(pathname: string): Promise<Document> {
    let response = await server.fetch(new Request(new URL(pathname, "http://localhost")));
    assert.equal(response.status, 200, `${pathname} renders`);
    let markup = await response.text();
    let tags = [...markup.matchAll(/<(script|link)\b[^>]*>/g)].map(([tag]) => tag);

    let mapAt = markup.indexOf('<script type="importmap">');
    assert.ok(mapAt !== -1, `${pathname} delivers an import map`);
    let firstModuleTag = markup.search(/<link rel="modulepreload"|<script type="module"/);
    assert.ok(
        mapAt < firstModuleTag,
        `${pathname} delivers the map before module links and scripts`,
    );
    let mapJson = markup.slice(markup.indexOf(">", mapAt) + 1, markup.indexOf("</script>", mapAt));
    let parsed: { imports: Record<string, string> } = JSON.parse(mapJson);
    let importMap = parsed.imports;

    let document: Document = {
        importMap,
        scripts: tags
            .map(attributes)
            .filter(tag => tag.type === "module" && tag.src)
            .map(tag => tag.src!),
        preloads: tags
            .map(attributes)
            .filter(tag => tag.rel === "modulepreload")
            .map(tag => tag.href!),
        stylesheets: tags
            .map(attributes)
            .filter(tag => tag.rel === "stylesheet")
            .map(tag => tag.href!),
    };
    assert.equal(document.scripts.length, 1, `${pathname} boots one client entry`);
    assert.ok(document.preloads.length > 0, `${pathname} preloads its chunks`);
    assert.ok(document.stylesheets.length > 0, `${pathname} links its stylesheets`);
    [...document.scripts, ...document.preloads, ...document.stylesheets].forEach(assertPublished);
    return document;
}

let home = await render("/");
let about = await render("/about");
let post = await render("/blog/hello-world");

// The plugin's `chunkImportMap` option is on, so chunks import each other through the map.
assert.ok(Object.keys(home.importMap).length > 0, "the client build has an import map");
Object.values(home.importMap).forEach(assertPublished);
assert.deepEqual(about.importMap, home.importMap, "every document carries the whole map");

assert.deepEqual(about.scripts, home.scripts, "every route boots the same client entry");

// Only /about imports about/page.css, so only /about links it.
let aboutOnly = about.stylesheets.filter(href => !home.stylesheets.includes(href));
assert.equal(aboutOnly.length, 1, "/about links one stylesheet that / does not");
assert.ok(!post.stylesheets.includes(aboutOnly[0]!), "the post does not link /about's stylesheet");

// Each route's module is a lazy chunk preloaded only by the route that renders it.
for (let [name, document, others] of [
    ["/", home, [about, post]],
    ["/about", about, [home, post]],
    ["/blog/hello-world", post, [home, about]],
] as const) {
    let own = document.preloads.filter(href =>
        others.every(other => !other.preloads.includes(href)),
    );
    assert.ok(own.length > 0, `${name} preloads a chunk no other route preloads`);
}

console.log(
    JSON.stringify(
        {
            importMapEntries: Object.keys(home.importMap).length,
            routes: {
                "/": { ...home, importMap: undefined },
                "/about": { ...about, importMap: undefined },
                "/blog/hello-world": { ...post, importMap: undefined },
            },
        },
        undefined,
        4,
    ),
);
