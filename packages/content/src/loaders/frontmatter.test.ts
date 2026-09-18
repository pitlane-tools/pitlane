import { describe, expect, it } from "vitest";

import { splitFrontmatter } from "./frontmatter.ts";

describe("splitFrontmatter", () => {
    it("reads a leading fenced block as data and the rest as the body", () => {
        expect(splitFrontmatter("---\ntitle: Hello\n---\n\n# Greeting\n")).toEqual({
            data: { title: "Hello" },
            body: "\n# Greeting\n",
        });
    });

    it("keeps a thematic break in the body, because only a leading fence is frontmatter", () => {
        let document = "# Hello\n\nIntro.\n\n---\n\nAfter the break.\n";

        expect(splitFrontmatter(document)).toEqual({ data: {}, body: document });
    });

    it("leaves a document whose only fences are thematic breaks entirely alone", () => {
        // Two breaks look exactly like a fenced block to an unanchored match.
        let document = "# Hello\n\nIntro.\n\n---\n\nMiddle.\n\n---\n\nEnd.\n";

        expect(splitFrontmatter(document)).toEqual({ data: {}, body: document });
    });

    it("takes the first closing fence, so a break after the frontmatter stays in the body", () => {
        let { data, body } = splitFrontmatter("---\ntitle: Hello\n---\n\nOne\n\n---\n\nTwo\n");

        expect(data).toEqual({ title: "Hello" });
        expect(body).toBe("\nOne\n\n---\n\nTwo\n");
    });

    it("treats a document with no fence at all as all body", () => {
        expect(splitFrontmatter("# Greeting\n")).toEqual({ data: {}, body: "# Greeting\n" });
    });

    it("treats an empty fenced block as no data", () => {
        expect(splitFrontmatter("---\n---\n\n# Greeting\n")).toEqual({
            data: {},
            body: "\n# Greeting\n",
        });
    });

    it("keeps reading data past a value that ends in a fence", () => {
        let { data, body } = splitFrontmatter(
            "---\ntitle: foo---\nsummary: should be data\n---\n\n# Body\n\nreal body\n",
        );

        expect(data).toEqual({ title: "foo---", summary: "should be data" });
        expect(body).toBe("\n# Body\n\nreal body\n");
    });

    it("keeps reading data past a value that ends in a fence and trailing spaces", () => {
        let { data, body } = splitFrontmatter(
            "---\ntitle: foo---   \nsummary: data\n---\n\nBody\n",
        );

        expect(data).toEqual({ title: "foo---", summary: "data" });
        expect(body).toBe("\nBody\n");
    });

    it("leaves a value containing a fence mid-line alone", () => {
        let { data, body } = splitFrontmatter("---\ntitle: a---b\n---\n\n# Greeting\n");

        expect(data).toEqual({ title: "a---b" });
        expect(body).toBe("\n# Greeting\n");
    });

    it("keeps an indented fence inside a block scalar in the data", () => {
        let document = "---\nsummary: |\n  intro\n  ---\n  outro\ntitle: Hello\n---\n\n# Body\n";
        let { data, body } = splitFrontmatter(document);

        expect(data).toEqual({ summary: "intro\n---\noutro\n", title: "Hello" });
        expect(body).toBe("\n# Body\n");
    });

    it("closes on a fence followed by trailing whitespace", () => {
        let { data, body } = splitFrontmatter("---\ntitle: Hello\n---   \n\n# Greeting\n");

        expect(data).toEqual({ title: "Hello" });
        expect(body).toBe("\n# Greeting\n");
    });

    it("accepts CRLF line endings", () => {
        let { data, body } = splitFrontmatter("---\r\ntitle: Hello\r\n---\r\n\r\n# Greeting\r\n");

        expect(data).toEqual({ title: "Hello" });
        expect(body).toBe("\r\n# Greeting\r\n");
    });

    it("rejects a fenced block that does not start the document", () => {
        // A byte of prose before the fence means it is not frontmatter.
        let document = "x\n---\ntitle: Hello\n---\n\n# Greeting\n";

        expect(splitFrontmatter(document)).toEqual({ data: {}, body: document });
    });
});
