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

assert.throws(() => import.meta.resolve("remix"), "the remix package must not be installed");

let root = import.meta.dirname;
// The bundle does not exist until a build, so it cannot be a static import.
let bundle: { default: App } = await import(pathToFileURL(join(root, "dist/ssr/index.js")).href);
let clientRoot = join(root, "dist/client");

function attributes(document: string, pattern: RegExp): string[] {
    return [...document.matchAll(pattern)].map(match => match[1]!);
}

async function render(pathname: string) {
    let response = await bundle.default.fetch(new Request(`http://localhost${pathname}`));
    assert.equal(response.status, 200, `${pathname} renders`);
    let document = await response.text();
    let page = {
        document,
        scripts: attributes(document, /<script type="module" src="([^"]+)"/g),
        preloads: attributes(document, /<link rel="modulepreload" href="([^"]+)"/g),
        stylesheets: attributes(document, /<link rel="stylesheet" href="([^"]+)"/g),
        importMap: /<script type="importmap">(.*?)<\/script>/s.exec(document)?.[1],
    };
    for (let href of [...page.scripts, ...page.preloads, ...page.stylesheets]) {
        assert.match(
            href,
            /^\/assets\/[\w.-]+-[\w-]{8}\.(js|css)$/,
            `${href} is a hashed build file`,
        );
        assert.ok(existsSync(join(clientRoot, href)), `${href} exists in dist/client`);
    }
    return page;
}

let home = await render("/");
let about = await render("/about");

// Each island renders on the server as a declarative shadow root, with its
// `static styles` inside it, so its CSS never needs a <link>.
for (let tag of ["lit-counter", "lit-greeting"]) {
    assert.match(home.document, new RegExp(`<${tag}[^>]*><template shadowroot(mode)?="open"`));
}

// The home page loads both islands' entries and preloads their chunks.
for (let island of ["counter", "greeting"]) {
    let entry = home.scripts.find(href => href.includes(`/${island}.client-`));
    assert.ok(entry, `the home page loads the ${island} island`);
    assert.ok(home.preloads.includes(entry), `the home page preloads the ${island} island`);
}

// With chunk import maps on, the map comes before every module link and script.
assert.ok(home.importMap, "the home page has an import map");
let mapAt = home.document.indexOf('<script type="importmap">');
let firstModuleAt = home.document.search(/<link rel="modulepreload"|<script type="module"/);
assert.ok(mapAt < firstModuleAt, "the import map precedes module links and scripts");
for (let target of Object.values(JSON.parse(home.importMap).imports as Record<string, string>)) {
    assert.ok(existsSync(join(clientRoot, target)), `import map target ${target} exists`);
}

// The about page has no islands, so it ships no JavaScript at all.
assert.deepEqual(about.scripts, [], "the about page loads no island");
assert.deepEqual(about.preloads, [], "the about page preloads no island chunk");
assert.equal(about.importMap, undefined, "the about page needs no import map");

// Each page imports its own stylesheet beside the shared one.
assert.ok(home.stylesheets.length > 0 && about.stylesheets.length > 0);
assert.notDeepEqual(home.stylesheets, about.stylesheets, "the pages' stylesheets differ");
let shared = home.stylesheets.filter(href => about.stylesheets.includes(href));
assert.equal(shared.length, 1, "both pages link the shared stylesheet");

console.log(
    JSON.stringify(
        {
            "/": { scripts: home.scripts, preloads: home.preloads, stylesheets: home.stylesheets },
            "/about": {
                scripts: about.scripts,
                preloads: about.preloads,
                stylesheets: about.stylesheets,
            },
            importMap: JSON.parse(home.importMap),
        },
        undefined,
        4,
    ),
);
