// Exercises the manifest `rsbuild build` wrote, through the published resolver
// alone. Run it after a build, from an install outside the Pitlane repository:
// inside the repository, Node would find the Vite that `@pitlane/assets`
// develops against and the first check would fail.
import type { BuildAssetsManifest } from "@pitlane/assets";

import { createAssetResolver, renderImportMap } from "@pitlane/assets";
import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

for (let specifier of ["vite", "remix", "@remix-run/component"]) {
    assert.throws(
        () => import.meta.resolve(specifier),
        `${specifier} must not be installed beside this example`,
    );
}

let root = import.meta.dirname;
let manifestFile = join(root, "dist/server/pitlane-assets-manifest.json");
let manifestText = readFileSync(manifestFile, "utf8");
let manifest = JSON.parse(manifestText) as BuildAssetsManifest;

assert.equal(manifest.mode, "build");
assert.equal(manifest.serverEnvironment, "node");
assert.deepEqual(Object.keys(manifest.environments).sort(), ["node", "web"]);
assert.equal(manifest.environments.web?.role, "client");
assert.equal(manifest.environments.node?.role, "server");
assert.ok(!manifestText.includes(realpathSync(root)), "the manifest names no checkout path");

let assets = createAssetResolver(manifest);

// Every public URL the resolver returns is a file the client build wrote.
function assertPublished(href: string) {
    assert.match(href, /^\/static\//);
    assert.ok(existsSync(join(root, "dist/web", href)), `${href} exists in dist/web`);
}

let entry = await assets.getScriptEntry("src/client.ts");
assertPublished(entry.href);
assert.match(entry.href, /\.js$/);
assert.equal(entry.preloads[0], entry.href, "the entry preloads itself first");
entry.preloads.forEach(assertPublished);
assert.deepEqual(entry.importMap, { imports: {} });
assert.equal(renderImportMap({ value: entry.importMap }), "");

// The shared chunk is a static startup dependency of the entry.
let shared = await assets.getPreloads("src/shared.ts");
assert.equal(shared.length, 1);
assert.ok(entry.preloads.includes(shared[0]!), "the entry preloads the shared chunk");

// A dynamically imported module is observed, but is neither an entry nor a preload of its importer.
let lazy = await assets.getPreloads("src/lazy.ts");
assert.equal(lazy.length, 1);
assertPublished(lazy[0]!);
assert.ok(!entry.preloads.includes(lazy[0]!), "dynamic chunks are not preloaded with the entry");
await assert.rejects(assets.getScriptEntry("src/lazy.ts"));

let clientStyles = await assets.getStylesheets("src/client.ts", { environment: "web" });
assert.equal(clientStyles.length, 1);
clientStyles.forEach(assertPublished);
let lazyStyles = await assets.getStylesheets("src/lazy.ts", { environment: "web" });
assert.equal(lazyStyles.length, 1);
assert.ok(!clientStyles.includes(lazyStyles[0]!), "lazy CSS stays out of the entry's stylesheets");

// Server-imported CSS is observed in the server graph and copied to the public output.
let serverStyles = await assets.getStylesheets("src/server.ts", { environment: "node" });
assert.equal(serverStyles.length, 1);
serverStyles.forEach(assertPublished);
assert.deepEqual(await assets.getStylesheets("src/server.ts"), serverStyles);

let logo = await assets.getHref("src/logo.svg");
assertPublished(logo);
assert.match(logo, /\.svg$/);

console.log(
    JSON.stringify(
        { entry, shared, lazy, clientStyles, lazyStyles, serverStyles, logo },
        undefined,
        4,
    ),
);
