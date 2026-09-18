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

    it("refuses a cycle rather than recursing until the stack ends", () => {
        let cyclic: Record<string, unknown> = { name: "loop" };
        cyclic.self = cyclic;

        expect(() => literal(cyclic, "blog/hello")).toThrow(/blog\/hello.*cycle/s);
    });
});
