import { describe, expect, it } from "vitest";

import { literal } from "./codegen.ts";

/**
 * Reads a value back out of the source `literal` produced.
 *
 * Evaluating is the assertion: the contract is that the emitted source parses
 * and yields the original value, and only evaluation shows that. It runs as a
 * real module rather than through `new Function`, because a module is what the
 * emitted manifest is.
 */
async function roundTrip(value: unknown) {
    let source = `export default (${literal(value)});`;
    // The specifier is the subject of the test, so it cannot be static.
    let module = (await import(`data:text/javascript,${encodeURIComponent(source)}`)) as {
        default: unknown;
    };
    return module.default;
}

describe("literal", () => {
    it("round-trips the values a schema produces", async () => {
        let values: unknown[] = [
            "hello",
            "",
            0,
            -1.5,
            true,
            false,
            null,
            [],
            {},
            [1, "two", { three: true }],
            { nested: { deeply: { enough: [1, 2, 3] } } },
        ];

        for (let value of values) expect(await roundTrip(value)).toEqual(value);
    });

    it("carries a Date through as a Date, not the string it was written as", async () => {
        let date = new Date("2026-01-02T03:04:05.678Z");
        let read = (await roundTrip({ publishedOn: date })) as { publishedOn: Date };

        expect(read.publishedOn).toBeInstanceOf(Date);
        expect(read.publishedOn.toISOString()).toBe(date.toISOString());
    });

    it("keeps a string that would otherwise break the source it is written into", async () => {
        let awkward = {
            quotes: `he said "no" and 'no' again`,
            newlines: "one\ntwo\r\nthree",
            backslash: "C:\\content\\blog",
            unicode: "héllo 🌍 \u2028\u2029",
            template: "${notAnExpression} `backtick`",
        };

        expect(await roundTrip(awkward)).toEqual(awkward);
    });

    it("keeps a key that is not a valid identifier", async () => {
        let keys = { "with space": 1, "dash-ed": 2, "0leading": 3, "": 4, 'quote"d': 5 };

        expect(await roundTrip(keys)).toEqual(keys);
    });

    it("keeps a bigint and an undefined inside an array", async () => {
        expect(await roundTrip(10n)).toBe(10n);
        expect(await roundTrip([1, undefined, 3])).toEqual([1, undefined, 3]);
    });

    it("refuses a value it cannot write, naming the entry and the type", () => {
        let unrepresentable: [string, unknown][] = [
            ["Map", new Map([["a", 1]])],
            ["Set", new Set([1])],
            ["RegExp", /x/],
            ["URL", new URL("https://example.com")],
            ["function", () => 1],
            ["symbol", Symbol("s")],
        ];

        for (let [name, value] of unrepresentable) {
            let thrown = () => literal({ field: value }, "blog/hello");

            expect(thrown).toThrow(new RegExp(`blog/hello produced a.* ${name}`));
            expect(thrown).toThrow(/cannot be written into the manifest/);
        }
    });

    it("refuses a non-finite number rather than writing null", () => {
        for (let value of [Number.NaN, Infinity, -Infinity]) {
            expect(() => literal({ score: value }, "blog/hello")).toThrow(
                /blog\/hello.*cannot be written into the manifest/s,
            );
        }
    });

    it("refuses a class instance rather than flattening it to its own fields", () => {
        class Author {
            name = "Ada";
            greet() {
                return this.name;
            }
        }

        expect(() => literal({ author: new Author() }, "blog/hello")).toThrow(
            /cannot be written into the manifest/,
        );
    });

    it("refuses a __proto__ key rather than writing a prototype assignment", () => {
        // `{ "__proto__": ... }` in an object literal sets the prototype instead
        // of defining a property, so writing the key verbatim makes a prebuilt
        // collection disagree with a runtime-resolved one about the same data.
        let data = JSON.parse('{ "a": 1, "__proto__": { "injected": true } }') as unknown;

        expect(() => literal(data, "blog/hello")).toThrow(
            /blog\/hello.*cannot be written into the manifest/s,
        );
    });

    it("refuses a null prototype rather than re-emitting it as a plain object", () => {
        let bare = Object.create(null) as Record<string, unknown>;
        bare.a = 1;

        expect(() => literal(bare, "blog/hello")).toThrow(/cannot be written into the manifest/);
    });

    it("refuses a key it would silently drop", () => {
        let withHidden = { a: 1 };
        Object.defineProperty(withHidden, "hidden", { value: 2, enumerable: false });
        let withSymbol = { a: 1, [Symbol("s")]: 2 };
        let arrayWithFields = Object.assign([1, 2], { extra: 3 });

        for (let value of [withHidden, withSymbol, arrayWithFields]) {
            expect(() => literal(value, "blog/hello")).toThrow(
                /cannot be written into the manifest/,
            );
        }
    });

    it("refuses an invalid Date with its own message rather than a bare RangeError", () => {
        let error = (() => {
            try {
                literal({ publishedOn: new Date("nonsense") }, "blog/hello");
            } catch (thrown) {
                return thrown as Error;
            }
            return undefined;
        })();

        expect(error?.message).toMatch(/blog\/hello.*cannot be written into the manifest/s);
        expect(error).not.toBeInstanceOf(RangeError);
    });

    it("preserves an object's prototype across the round trip", async () => {
        // `toEqual` ignores prototypes, so the round-trip suite above cannot
        // see a plain object arriving where a bare one went in.
        expect(await roundTrip({ nested: { a: 1 } })).toStrictEqual({ nested: { a: 1 } });
    });

    it("refuses a cycle rather than recursing until the stack ends", () => {
        let cyclic: Record<string, unknown> = { name: "loop" };
        cyclic.self = cyclic;

        expect(() => literal(cyclic, "blog/hello")).toThrow(/blog\/hello.*cycle/s);
    });
});
