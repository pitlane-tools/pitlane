import { describe, expect, it } from "vite-plus/test";

import { manifestProblems, parseManifest } from "../scripts/manifest.ts";

let theme = {
    name: "@pitlane/theme",
    exports: { ".": {}, "./schema": {} },
};
let content = {
    name: "@pitlane/content",
    exports: { ".": {}, "./internal/manifest": {} },
};

describe("parseManifest", () => {
    it("drops the keys that annotate the file", () => {
        let manifest = parseManifest({ _comment: "notes", "pitlane/theme": "@pitlane/theme" });
        expect([...manifest]).toEqual([["pitlane/theme", "@pitlane/theme"]]);
    });
});

describe("manifestProblems", () => {
    it("accepts a manifest that maps every public export once", () => {
        let manifest = parseManifest({
            "pitlane/theme": "@pitlane/theme",
            "pitlane/theme/schema": "@pitlane/theme/schema",
            "pitlane/content": "@pitlane/content",
        });
        expect(manifestProblems(manifest, [theme, content])).toEqual([]);
    });

    it("reports a public export the manifest leaves out", () => {
        let manifest = parseManifest({
            "pitlane/theme": "@pitlane/theme",
            "pitlane/content": "@pitlane/content",
        });
        expect(manifestProblems(manifest, [theme, content])).toEqual([
            "@pitlane/theme/schema has no pitlane/* subpath",
        ]);
    });

    it("reports an internal export the manifest re-exports", () => {
        let manifest = parseManifest({
            "pitlane/theme": "@pitlane/theme",
            "pitlane/theme/schema": "@pitlane/theme/schema",
            "pitlane/content": "@pitlane/content",
            "pitlane/content/internal/manifest": "@pitlane/content/internal/manifest",
        });
        expect(manifestProblems(manifest, [theme, content])).toEqual([
            "pitlane/content/internal/manifest re-exports @pitlane/content/internal/manifest, which is internal",
        ]);
    });

    it("reports a target no package exports", () => {
        let manifest = parseManifest({
            "pitlane/theme": "@pitlane/theme",
            "pitlane/theme/schema": "@pitlane/theme/schema",
            "pitlane/theme/tokens": "@pitlane/theme/tokens",
            "pitlane/content": "@pitlane/content",
        });
        expect(manifestProblems(manifest, [theme, content])).toEqual([
            "pitlane/theme/tokens re-exports @pitlane/theme/tokens, which no package exports",
        ]);
    });

    it("reports two subpaths re-exporting the same target", () => {
        let manifest = parseManifest({
            "pitlane/theme": "@pitlane/theme",
            "pitlane/styles": "@pitlane/theme",
            "pitlane/theme/schema": "@pitlane/theme/schema",
            "pitlane/content": "@pitlane/content",
        });
        expect(manifestProblems(manifest, [theme, content])).toEqual([
            "pitlane/styles and pitlane/theme both re-export @pitlane/theme",
        ]);
    });

    it("reports a subpath outside pitlane/", () => {
        let manifest = parseManifest({
            "pitlane/theme": "@pitlane/theme",
            "theme/schema": "@pitlane/theme/schema",
            "pitlane/content": "@pitlane/content",
        });
        expect(manifestProblems(manifest, [theme, content])).toEqual([
            "theme/schema must start with pitlane/",
        ]);
    });
});
