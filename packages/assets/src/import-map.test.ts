import * as fc from "fast-check";
import { describe, expect, it } from "vite-plus/test";

import type { ImportMap } from "./types.ts";

import { renderImportMap } from "./import-map.ts";

// The script element's shape. Its body is everything up to the first "<",
// which is where an HTML parser would look for the end tag.
const ELEMENT = /^<script type="importmap"(?: nonce="([^"]*)")?>([^<]*)<\/script>$/;

/** Decodes the character references an attribute value can carry, in one pass as HTML does. */
function decodeAttribute(text: string): string {
    return text.replace(/&(amp|quot|lt|gt|#39|#x27);/g, (_, name: string) => {
        let decoded: Record<string, string> = {
            amp: "&",
            quot: '"',
            lt: "<",
            gt: ">",
            "#39": "'",
            "#x27": "'",
        };
        return decoded[name]!;
    });
}

function parse(html: string): { nonce: string | undefined; value: unknown } {
    let match = ELEMENT.exec(html);
    if (!match) throw new Error(`not a single import-map element: ${html}`);
    return {
        nonce: match[1] === undefined ? undefined : decodeAttribute(match[1]),
        value: JSON.parse(match[2]!),
    };
}

describe("proposal 0005: renderImportMap", () => {
    it("serializes a map into an inline import-map script", () => {
        let value: ImportMap = {
            imports: { "/assets/counter-K1.js": "/assets/counter-d4.js" },
            scopes: { "/assets/": { lodash: "/assets/lodash-x9.js" } },
            integrity: { "/assets/counter-d4.js": "sha384-abc" },
        };

        expect(renderImportMap({ value })).toBe(
            '<script type="importmap">{"imports":{"/assets/counter-K1.js":"/assets/counter-d4.js"},"scopes":{"/assets/":{"lodash":"/assets/lodash-x9.js"}},"integrity":{"/assets/counter-d4.js":"sha384-abc"}}</script>',
        );
    });

    it("escapes < as a JSON Unicode escape so map text cannot close the element", () => {
        let html = renderImportMap({
            value: { imports: { "</script><script>alert(1)</script>": "/x.js" } },
        });

        expect(html).toBe(
            '<script type="importmap">{"imports":{"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>":"/x.js"}}</script>',
        );
        expect(parse(html).value).toEqual({
            imports: { "</script><script>alert(1)</script>": "/x.js" },
        });
    });

    it("writes a nonce as an escaped, quoted attribute", () => {
        let html = renderImportMap({
            value: { imports: { a: "/a.js" } },
            nonce: 'r4nd"&<om>',
        });

        expect(html).toBe(
            '<script type="importmap" nonce="r4nd&quot;&amp;&lt;om&gt;">{"imports":{"a":"/a.js"}}</script>',
        );
    });

    it("returns an empty string when no mapping is effective", () => {
        expect(renderImportMap({ value: { imports: {} } })).toBe("");
        expect(renderImportMap({ value: { imports: {}, scopes: {}, integrity: {} } })).toBe("");
        expect(renderImportMap({ value: { imports: {}, scopes: { "/a/": {}, "/b/": {} } } })).toBe(
            "",
        );
        expect(renderImportMap({ value: { imports: {} }, nonce: "abc" })).toBe("");
    });

    it("keeps a map whose only mappings are scoped or integrity metadata", () => {
        expect(
            renderImportMap({ value: { imports: {}, scopes: { "/a/": { x: "/x.js" } } } }),
        ).not.toBe("");
        expect(
            renderImportMap({ value: { imports: {}, integrity: { "/x.js": "sha384-a" } } }),
        ).not.toBe("");
    });

    // Includes the sequences that end or reopen script data, and their mixed-case spellings.
    let hostile = fc.oneof(
        fc.string({ unit: "binary" }),
        fc.constantFrom("</script>", "</SCRIPT >", "<!--", "<script", "-->", '"', "&", "\u2028"),
        fc
            .array(fc.constantFrom("<", "/", "script", "!--", ">", "S", '"', "&", "x"))
            .map(parts => parts.join("")),
    );
    let mappings = fc.dictionary(hostile, hostile, { minKeys: 1, maxKeys: 4 });
    let importMap: fc.Arbitrary<ImportMap> = fc.record(
        {
            imports: mappings,
            scopes: fc.dictionary(hostile, mappings, { maxKeys: 3 }),
            integrity: fc.dictionary(hostile, hostile, { maxKeys: 3 }),
        },
        { requiredKeys: ["imports"] },
    );

    it("always produces one element whose parsed map equals the input", () => {
        fc.assert(
            fc.property(importMap, fc.option(hostile, { nil: undefined }), (value, nonce) => {
                let parsed = parse(renderImportMap({ value, nonce }));

                expect(parsed.value).toEqual(value);
                expect(parsed.nonce).toBe(nonce);
            }),
            { seed: 5, numRuns: 500 },
        );
    });
});
