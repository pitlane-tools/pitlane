import type { TestContext } from "node:test";

import assert from "node:assert/strict";
import test from "node:test";

import { check } from "./readme.ts";
import { fixture } from "./support/fixture.ts";

let manifest = { name: "@pitlane/widget" };

function readme(t: TestContext, content: string): string[] {
    return check(
        fixture(t, {
            "packages/widget/package.json": manifest,
            "packages/widget/README.md": content,
        }),
    );
}

let usage = '```ts\nimport { widget } from "@pitlane/widget/schema";\n```\n';

test("policy.0011: a README that installs and imports the package passes, whatever the package manager", t => {
    for (let install of [
        "npm install @pitlane/widget",
        "npm i -D @pitlane/widget",
        "pnpm add @pitlane/widget",
        "yarn add --dev @pitlane/widget",
        "bun add @pitlane/widget",
        "vp add -D @pitlane/widget",
        "<InstallGroup packages={['@pitlane/widget']} />",
    ]) {
        assert.deepEqual(
            readme(t, `# Widget\n\n\`\`\`sh\n${install}\n\`\`\`\n\n${usage}`),
            [],
            install,
        );
    }
});

test("policy.0011: a README with no install line for the package fails", t => {
    assert.deepEqual(
        readme(t, `# Widget\n\n\`\`\`sh\nnpm install @pitlane/widget-extra\n\`\`\`\n\n${usage}`),
        [
            "packages/widget/README.md: no install command for @pitlane/widget; add one, such as `npm install @pitlane/widget` (policy.0011)",
        ],
    );
});

test("policy.0011: a README that never imports the package fails", t => {
    assert.deepEqual(
        readme(
            t,
            '```sh\nnpm install @pitlane/widget\n```\n\n```ts\nimport { x } from "pitlane/widget";\n```\n',
        ),
        [
            "packages/widget/README.md: no import from @pitlane/widget or its subpaths; show one, so the README stands on its own (policy.0011)",
        ],
    );
});

test("policy.0011: a published package without a README fails, and unpublished packages are not checked", t => {
    let root = fixture(t, {
        "packages/widget/package.json": manifest,
        "packages/checker/package.json": { name: "@pitlane/checker", private: true },
        "packages/pitlane/package.json": { name: "pitlane" },
    });
    assert.deepEqual(check(root), [
        "packages/widget/README.md: missing; every published package needs a README that installs and imports it (policy.0011)",
    ]);
});
