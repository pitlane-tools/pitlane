import { globSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it } from "vite-plus/test";

import { generateUmbrella } from "../scripts/generate.ts";

const PACKAGE = resolve(import.meta.dirname, "..");
const STALE =
    "The umbrella is stale: run `vp run generate` in packages/pitlane and commit the result.";

it("commits exactly what the generator produces from manifest.json", () => {
    let umbrella = generateUmbrella(PACKAGE);

    let committed = globSync("src/**/*.ts", { cwd: PACKAGE }).sort();
    expect(committed, STALE).toEqual([...umbrella.files.keys()].sort());
    for (let [path, contents] of umbrella.files) {
        expect(readFileSync(join(PACKAGE, path), "utf8"), `${STALE} (${path})`).toBe(contents);
    }

    let manifest = JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8"));
    for (let [field, value] of Object.entries(umbrella.fields)) {
        expect(manifest[field], `${STALE} (package.json ${field})`).toEqual(value);
    }
});
