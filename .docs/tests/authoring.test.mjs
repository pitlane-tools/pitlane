import assert from "node:assert/strict";
import test from "node:test";
import { mdxToJs } from "satteri";

import { bindings } from "../build/bindings.ts";
import { codeBlocks, outline } from "../build/satteri.ts";

function compile(source) {
    return mdxToJs(source, {
        fileURL: new URL("authoring.mdx", import.meta.url),
        jsxImportSource: "remix/ui",
        hastPlugins: [bindings(), outline(), codeBlocks()],
    });
}

test("variant and partial outlines follow imported component identities, including aliases", async () => {
    let { data } =
        await compile(`import { Vite as Built, NoBuild as Runtime, Include as Partial } from "../app/components/documentation.tsx";
import { default as shared } from "./shared.mdx";

<Built>

## Compiled

</Built>

<Runtime>

## Runtime

</Runtime>

<Partial document={shared} />
`);
    assert.deepEqual(data.outline, [
        { heading: { id: "compiled", text: "Compiled", level: 2, buildMode: "vite" } },
        { heading: { id: "runtime", text: "Runtime", level: 2, buildMode: "no-build" } },
        { include: { specifier: "./shared.mdx" } },
    ]);
});

test("unrelated components named Vite or Include do not acquire documentation semantics", async () => {
    let { data } = await compile(`import { Vite, Include } from "./unrelated.tsx";

<Vite>

## Always visible

</Vite>

<Include />
`);
    assert.deepEqual(data.outline, [
        { heading: { id: "always-visible", text: "Always visible", level: 2 } },
    ]);
});

test("mutually exclusive variant scopes never advertise an unreachable heading", async () => {
    let { data } = await compile(`import * as Docs from "../app/components/documentation.tsx";

<Docs.Vite>
<Docs.NoBuild>

## Unreachable

</Docs.NoBuild>
</Docs.Vite>
`);
    assert.deepEqual(data.outline, []);
});
