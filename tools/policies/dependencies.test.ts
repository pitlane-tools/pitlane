import assert from "node:assert/strict";
import test from "node:test";

import { check } from "./dependencies.ts";
import { fixture } from "./support/fixture.ts";

let manifest = {
    name: "@pitlane/widget",
    dependencies: { yaml: "^2", "@pitlane/theme": "workspace:^" },
    peerDependencies: { remix: "^3", vite: ">=8" },
    optionalDependencies: { satteri: "^0.10" },
    devDependencies: { typescript: "^7" },
};

let reasons = {
    yaml: { reason: "YAML is hard to parse correctly.", publicTypes: false },
    vite: { reason: "The plugin subpath is a Vite plugin.", publicTypes: true },
    satteri: { reason: "Compiles Markdown.", publicTypes: false },
};

test("policy.0008: every third-party dependency with a reason passes, ignoring remix, @pitlane/*, and devDependencies", t => {
    let root = fixture(t, {
        "packages/widget/package.json": manifest,
        ".agents/dependencies.json": { "@pitlane/widget": reasons },
    });
    assert.deepEqual(check(root), []);
});

test("policy.0008: a dependency without a ledger entry fails", t => {
    let { satteri: _, ...rest } = reasons;
    let root = fixture(t, {
        "packages/widget/package.json": manifest,
        ".agents/dependencies.json": { "@pitlane/widget": rest },
    });
    let violations = check(root);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /^packages\/widget\/package\.json: .*"satteri".*\(policy\.0008\)$/);
});

test("policy.0008: a ledger entry with an empty reason fails", t => {
    let root = fixture(t, {
        "packages/widget/package.json": manifest,
        ".agents/dependencies.json": {
            "@pitlane/widget": { ...reasons, yaml: { reason: "  ", publicTypes: false } },
        },
    });
    let violations = check(root);
    assert.equal(violations.length, 1);
    assert.match(
        violations[0],
        /^\.agents\/dependencies\.json: .*"yaml".*reason.*\(policy\.0008\)$/,
    );
});

test("policy.0008: a ledger entry without a boolean publicTypes fails", t => {
    let root = fixture(t, {
        "packages/widget/package.json": manifest,
        ".agents/dependencies.json": {
            "@pitlane/widget": { ...reasons, yaml: { reason: "Parses YAML." } },
        },
    });
    let violations = check(root);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /"yaml".*publicTypes/);
});

test("policy.0008: a ledger entry naming a dependency the package does not have is stale", t => {
    let root = fixture(t, {
        "packages/widget/package.json": manifest,
        ".agents/dependencies.json": {
            "@pitlane/widget": {
                ...reasons,
                "magic-string": { reason: "Rewrites code.", publicTypes: false },
            },
        },
    });
    let violations = check(root);
    assert.equal(violations.length, 1);
    assert.match(
        violations[0],
        /^\.agents\/dependencies\.json: .*"magic-string".*\(policy\.0008\)$/,
    );
});

test("policy.0008: a ledger section for a package that is not published is stale", t => {
    let root = fixture(t, {
        "packages/widget/package.json": manifest,
        "packages/checker/package.json": {
            name: "@pitlane/checker",
            private: true,
            dependencies: { yaml: "^2" },
        },
        "packages/pitlane/package.json": { name: "pitlane", dependencies: { yaml: "^2" } },
        ".agents/dependencies.json": {
            "@pitlane/widget": reasons,
            "@pitlane/checker": { yaml: { reason: "Parses YAML.", publicTypes: false } },
        },
    });
    let violations = check(root);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /"@pitlane\/checker"/);
});

test("policy.0008: a missing ledger fails", t => {
    let root = fixture(t, { "packages/widget/package.json": manifest });
    let violations = check(root);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /^\.agents\/dependencies\.json: .*\(policy\.0008\)$/);
});
