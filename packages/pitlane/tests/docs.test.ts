import { expect, it } from "vite-plus/test";

import { installedReadmes } from "../scripts/docs.ts";
import { parseManifest } from "../scripts/manifest.ts";

let packages = [
    { name: "@pitlane/crawler", directory: "/repo/packages/crawler", description: "Crawls routes" },
    { name: "@pitlane/assets", directory: "/repo/packages/assets", description: "Asset URLs" },
    { name: "@pitlane/unused", directory: "/repo/packages/unused", description: "Not re-exported" },
];

it("mirrors each re-exported package's README beside its compiled subpaths, listing every subpath it documents", () => {
    let manifest = parseManifest({
        _comment: "ignored",
        "pitlane/assets/vite-plugin": "@pitlane/assets/vite-plugin",
        "pitlane/crawler": "@pitlane/crawler",
        "pitlane/assets": "@pitlane/assets",
        "pitlane/assets/manifest": "@pitlane/assets/manifest",
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
            name: "@pitlane/assets",
            description: "Asset URLs",
            readme: "/repo/packages/assets/README.md",
            path: "dist/assets/README.md",
            exports: ["pitlane/assets", "pitlane/assets/manifest", "pitlane/assets/vite-plugin"],
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
