import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function checkFixture(name) {
    let run = spawnSync(process.execPath, [".mdx/check.mjs", `.mdx/fixtures/${name}/tsconfig.json`], {
        cwd: new URL("../", import.meta.url),
        encoding: "utf8",
        timeout: 60_000,
    });
    assert.ifError(run.error);
    assert.equal(run.signal, null, run.stderr);
    return run;
}

test("valid Remix MDX imports, props, expressions and shared partials pass", () => {
    let run = checkFixture("valid");
    assert.equal(run.status, 0, run.stdout + run.stderr);
});

test("executable MDX failures retain their originating file and line", () => {
    let run = checkFixture("invalid");
    assert.equal(run.status, 1, run.stdout + run.stderr);
    for (let [file, lines] of Object.entries({
        props: [6, 8, 10],
        imports: [1, 2],
        expressions: [10, 12],
        "unknown-component": [3],
        "_unreferenced-partial": [3],
        syntax: [3],
    })) {
        for (let line of lines) {
            assert.match(run.stdout, new RegExp(`${file}\\.mdx:${line}:\\d+ - error`));
        }
    }
});
