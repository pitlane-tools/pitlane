import { headings } from "@pitlane/content/satteri";
import assert from "node:assert/strict";
import test from "node:test";
import { mdxToJs } from "satteri";

import { bindings } from "../build/bindings.ts";
import { codeBlocks, outline } from "../build/satteri.ts";

function compile(source: string) {
    return mdxToJs(source, {
        fileURL: new URL("authoring.mdx", import.meta.url),
        jsxImportSource: "remix/ui",
        mdastPlugins: [headings()],
        hastPlugins: [bindings(), outline(), codeBlocks()],
    });
}

test("variant and partial outlines follow imported component identities, including aliases", async () => {
    let { data, code } =
        await compile(`import { Vite as Built, NoBuild as Runtime, Include as Partial } from "../../.docs/app/components/documentation.tsx";
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
        { heading: { depth: 2, slug: "compiled", text: "Compiled", buildMode: "vite" } },
        { heading: { depth: 2, slug: "runtime", text: "Runtime", buildMode: "no-build" } },
        { include: { specifier: "./shared.mdx" } },
    ]);
    assert.match(code, /import \{ headings as included0 \} from "\.\/shared\.mdx"/);
    assert.match(code, /const headings = \[[\s\S]*"slug": "compiled"[\s\S]*\.\.\.included0\s*\]/);
});

test("unrelated components named Vite or Include do not acquire documentation semantics", async () => {
    let { data } = await compile(`import { Vite, Include } from "./unrelated.tsx";

<Vite>

## Always visible

</Vite>

<Include />
`);
    assert.deepEqual(data.outline, [
        { heading: { depth: 2, slug: "always-visible", text: "Always visible" } },
    ]);
});

test("mutually exclusive variant scopes never advertise an unreachable heading", async () => {
    let { data } =
        await compile(`import * as Docs from "../../.docs/app/components/documentation.tsx";

<Docs.Vite>
<Docs.NoBuild>

## Unreachable

</Docs.NoBuild>
</Docs.Vite>
`);
    assert.deepEqual(data.outline, []);
});
