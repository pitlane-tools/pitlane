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
