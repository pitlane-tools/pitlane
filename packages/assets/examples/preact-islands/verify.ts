// Renders each page through the built server bundle, with no HTTP server, and
// checks that every asset URL the documents name is a hashed file the client
// build wrote. Run it after `npm run build`.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

interface App {
    fetch(request: Request): Promise<Response>;
}

let root = import.meta.dirname;
let bundle: { default: App } = await import(pathToFileURL(join(root, "dist/ssr/index.js")).href);

function assertPublished(href: string) {
    assert.match(href, /^\/assets\/[\w.-]+-[\w-]{8}\.(js|css)$/, `${href} is a hashed build asset`);
    assert.ok(existsSync(join(root, "dist/client", href)), `${href} exists in dist/client`);
}

async function render(pathname: string) {
    let response = await bundle.default.fetch(new Request(new URL(pathname, "http://localhost")));
    assert.equal(response.status, 200, `${pathname} renders`);
    let markup = await response.text();
    let all = (pattern: RegExp) => [...markup.matchAll(pattern)].map(match => match[1]!);

    let page = {
        scripts: all(/<script type="module" src="([^"]+)"/g),
        preloads: all(/<link rel="modulepreload" href="([^"]+)"/g),
        stylesheets: all(/<link rel="stylesheet" href="([^"]+)"/g),
        islands: all(/<preact-island entry="([^"]+)"/g),
    };
    [...page.scripts, ...page.preloads, ...page.stylesheets, ...page.islands].forEach(
        assertPublished,
    );
    assert.equal(page.scripts.length, 1, `${pathname} loads only the client entry`);

    // The import map has to come before anything that loads a module.
    let map = /<script type="importmap">([^<]*)<\/script>/.exec(markup);
    assert.ok(map, `${pathname} delivers the chunk import map`);
    let firstModule = markup.search(/<link rel="modulepreload"|<script type="module"/);
    assert.ok(map.index < firstModule, `${pathname} renders the import map first`);
    let imports: Record<string, string> = JSON.parse(map[1]!).imports;
    Object.values(imports).forEach(assertPublished);

    return page;
}

let home = await render("/");
let about = await render("/about");

assert.equal(home.islands.length, 2, "the home page renders two islands");
assert.notEqual(home.islands[0], home.islands[1], "each island has its own chunk");
for (let island of home.islands) {
    assert.ok(home.preloads.includes(island), `the home page preloads ${island}`);
    assert.ok(!about.preloads.includes(island), `the about page does not preload ${island}`);
}
assert.equal(about.islands.length, 0, "the about page renders no islands");

assert.equal(home.scripts[0], about.scripts[0], "both pages load the same client entry");
let homeOnlyStyles = home.stylesheets.filter(href => !about.stylesheets.includes(href));
assert.ok(homeOnlyStyles.length > 0, "the home page links its own and its islands' CSS");

console.log(JSON.stringify({ home, about }, undefined, 4));
