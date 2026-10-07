// Renders each route through the built server bundle, with no HTTP server, and
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
// The bundle does not exist until a build, so it cannot be a static import.
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
        // Solid's hydration data names the chunk of the lazy route it rendered.
        lazy: all(/_\$HY\.r\["_assets"\]=\(\$R\[0\]=\{\d+:"([^"]+)"\}\)/g),
    };
    [...page.scripts, ...page.preloads, ...page.stylesheets, ...page.lazy].forEach(assertPublished);
    assert.equal(page.scripts.length, 1, `${pathname} loads only the client entry`);
    assert.equal(page.lazy.length, 1, `${pathname} renders one lazy route`);
    assert.ok(page.preloads.includes(page.lazy[0]!), `${pathname} preloads its route's chunk`);

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
let faq = await render("/faq");
let pages = { home, about, faq };

for (let [name, page] of Object.entries(pages)) {
    assert.equal(page.scripts[0], home.scripts[0], `${name} loads the same client entry`);
    for (let [other, otherPage] of Object.entries(pages)) {
        if (other === name) continue;
        assert.notEqual(
            page.lazy[0],
            otherPage.lazy[0],
            `${name} and ${other} are separate chunks`,
        );
        assert.ok(
            !otherPage.preloads.includes(page.lazy[0]!),
            `${other} does not preload the ${name} route's chunk`,
        );
    }
}

let aboutOnlyStyles = about.stylesheets.filter(href => !home.stylesheets.includes(href));
assert.equal(aboutOnlyStyles.length, 1, "the about route links its own stylesheet");
assert.deepEqual(faq.stylesheets, home.stylesheets, "routes without CSS share the entry's");

console.log(JSON.stringify(pages, undefined, 4));
