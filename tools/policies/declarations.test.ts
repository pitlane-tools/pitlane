import assert from "node:assert/strict";
import test from "node:test";

import { check } from "./declarations.ts";
import { fixture } from "./support/fixture.ts";

let manifest = {
    name: "@pitlane/widget",
    dependencies: { yaml: "^2" },
    peerDependencies: { remix: "^3", vite: ">=8" },
};

let ledger = {
    "@pitlane/widget": {
        yaml: { reason: "Parses YAML.", publicTypes: false },
        vite: { reason: "The plugin subpath is a Vite plugin.", publicTypes: true },
    },
};

let allowed = `import type { Plugin } from "vite";
import type { Handle } from "remix/component";
import type { Database } from "remix";
import type { Theme } from "@pitlane/theme";
import type { Self } from "@pitlane/widget/schema";
import type { Stats } from "node:fs";
import type { Env } from "cloudflare:workers";
import type { Local } from "./types-abc.d.mts";
export type { Entry } from "../entry.d.mts";
/**
 * \`\`\`ts
 * import { parse } from "yaml";
 * \`\`\`
 */
export declare function widget(): Plugin;
`;

test("policy.0010: declarations naming only allowed modules, including an allowed peer, pass", t => {
    let root = fixture(t, {
        "packages/widget/package.json": manifest,
        "packages/widget/dist/index.d.mts": allowed,
        ".agents/dependencies.json": ledger,
    });
    assert.deepEqual(check(root), []);
});

test("policy.0010: a third-party type the ledger does not allow is a leak, wherever it is named", t => {
    let root = fixture(t, {
        "packages/widget/package.json": manifest,
        "packages/widget/dist/index.d.mts": 'import type { Document } from "yaml";\n',
        "packages/widget/dist/nested/loaders.d.ts":
            'export * from "magic-string";\nexport declare let parse: typeof import("yaml/util").parse;\n',
        ".agents/dependencies.json": ledger,
    });
    assert.deepEqual(check(root).sort(), [
        'packages/widget/dist/index.d.mts:1: names "yaml", whose types the ledger does not allow in public declarations; replace it with a Pitlane-owned type (policy.0010)',
        'packages/widget/dist/nested/loaders.d.ts:1: names "magic-string", whose types the ledger does not allow in public declarations; replace it with a Pitlane-owned type (policy.0010)',
        'packages/widget/dist/nested/loaders.d.ts:2: names "yaml/util", whose types the ledger does not allow in public declarations; replace it with a Pitlane-owned type (policy.0010)',
    ]);
});

test("policy.0010: a type the ledger allows for another package is still a leak", t => {
    let root = fixture(t, {
        "packages/widget/package.json": manifest,
        "packages/widget/dist/index.d.mts": 'import type { Plugin } from "vite";\n',
        "packages/other/package.json": {
            name: "@pitlane/other",
            peerDependencies: { vite: ">=8" },
        },
        "packages/other/dist/index.d.mts": "export {};\n",
        ".agents/dependencies.json": {
            "@pitlane/widget": { yaml: ledger["@pitlane/widget"].yaml },
            "@pitlane/other": { vite: ledger["@pitlane/widget"].vite },
        },
    });
    assert.deepEqual(
        check(root).map(violation => violation.split(":")[0]),
        ["packages/widget/dist/index.d.mts"],
    );
});

test("policy.0010: a published package without built declarations fails rather than passing unchecked", t => {
    let root = fixture(t, {
        "packages/widget/package.json": manifest,
        "packages/widget/src/index.ts": "export {};\n",
        ".agents/dependencies.json": ledger,
    });
    assert.deepEqual(check(root), [
        "packages/widget/dist: no built declarations to check; run `vp run build` in packages/widget first (policy.0010)",
    ]);
});

test("policy.0010: private and unscoped packages are not checked", t => {
    let root = fixture(t, {
        "packages/checker/package.json": { name: "@pitlane/checker", private: true },
        "packages/pitlane/package.json": { name: "pitlane" },
        "packages/pitlane/dist/index.d.mts": 'import type { Document } from "yaml";\n',
    });
    assert.deepEqual(check(root), []);
});
