import { expect, it } from "vite-plus/test";

import { installedReadmes } from "../scripts/docs.ts";
import { parseManifest } from "../scripts/manifest.ts";

let packages = [
    { name: "@pitlane/crawler", directory: "/repo/packages/crawler", description: "Crawls routes" },
    { name: "@pitlane/dev", directory: "/repo/packages/dev", description: "The Vite plugin" },
    { name: "@pitlane/unused", directory: "/repo/packages/unused", description: "Not re-exported" },
];

it("mirrors each re-exported package's README beside its compiled subpaths, listing every subpath it documents", () => {
    let manifest = parseManifest({
        _comment: "ignored",
        "pitlane/dev/runtime": "@pitlane/dev/runtime",
        "pitlane/crawler": "@pitlane/crawler",
        "pitlane/dev": "@pitlane/dev",
        "pitlane/dev/assets": "@pitlane/dev/assets",
    });

    expect(installedReadmes(manifest, packages)).toEqual([
        {
            name: "@pitlane/crawler",
            description: "Crawls routes",
            readme: "/repo/packages/crawler/README.md",
            path: "dist/crawler/README.md",
            exports: ["pitlane/crawler"],
        },
        {
            name: "@pitlane/dev",
            description: "The Vite plugin",
            readme: "/repo/packages/dev/README.md",
            path: "dist/dev/README.md",
            exports: ["pitlane/dev", "pitlane/dev/assets", "pitlane/dev/runtime"],
        },
    ]);
});

it("does not mistake a package whose name extends another's for one of its subpaths", () => {
    let manifest = parseManifest({
        "pitlane/data-table": "@pitlane/data-table",
        "pitlane/data-table-d1": "@pitlane/data-table-d1",
    });
    let mirrored = installedReadmes(manifest, [
        { name: "@pitlane/data-table", directory: "/p/data-table", description: "A" },
        { name: "@pitlane/data-table-d1", directory: "/p/data-table-d1", description: "B" },
    ]);
    expect(mirrored.map(({ path, exports }) => [path, exports])).toEqual([
        ["dist/data-table/README.md", ["pitlane/data-table"]],
        ["dist/data-table-d1/README.md", ["pitlane/data-table-d1"]],
    ]);
});
