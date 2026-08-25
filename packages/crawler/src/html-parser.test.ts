import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parse } from "./html-parser.ts";

const FIXTURE_HTML = readFileSync(
    new URL("./fixtures/landing-page.html", import.meta.url),
    "utf-8",
);

const EXPECTED_TOTAL = 223;
const EXPECTED_HEAD = 1;
const EXPECTED_BODY = 1;
const EXPECTED_DIV = 26;
const EXPECTED_A = 47;
const EXPECTED_IMG = 20;
const EXPECTED_SCRIPT = 2;
const EXPECTED_LINK = 3;
const EXPECTED_META = 2;
const EXPECTED_SECTION = 7;
const EXPECTED_LI = 25;

describe("parse()", () => {
    it("parses all elements from a realistic HTML document", () => {
        let elements = parse(FIXTURE_HTML).elements;

        expect(elements).toHaveLength(EXPECTED_TOTAL);
    });

    it("parses the correct number of head elements", () => {
        let elements = parse(FIXTURE_HTML).elements;
        let head = elements.filter(el => el.name === "head");

        expect(head).toHaveLength(EXPECTED_HEAD);
    });

    it("parses the correct number of body elements", () => {
        let elements = parse(FIXTURE_HTML).elements;
        let body = elements.filter(el => el.name === "body");

        expect(body).toHaveLength(EXPECTED_BODY);
    });

    it("parses the correct number of div elements", () => {
        let elements = parse(FIXTURE_HTML).elements;
        let divs = elements.filter(el => el.name === "div");

        expect(divs).toHaveLength(EXPECTED_DIV);
    });

    it("parses the correct number of anchor elements", () => {
        let elements = parse(FIXTURE_HTML).elements;
        let anchors = elements.filter(el => el.name === "a");

        expect(anchors).toHaveLength(EXPECTED_A);
    });

    it("parses the correct number of img elements", () => {
        let elements = parse(FIXTURE_HTML).elements;
        let imgs = elements.filter(el => el.name === "img");

        expect(imgs).toHaveLength(EXPECTED_IMG);
    });

    it("parses the correct number of script elements", () => {
        let elements = parse(FIXTURE_HTML).elements;
        let scripts = elements.filter(el => el.name === "script");

        expect(scripts).toHaveLength(EXPECTED_SCRIPT);
    });

    it("parses the correct number of link elements", () => {
        let elements = parse(FIXTURE_HTML).elements;
        let links = elements.filter(el => el.name === "link");

        expect(links).toHaveLength(EXPECTED_LINK);
    });

    it("parses the correct number of meta elements", () => {
        let elements = parse(FIXTURE_HTML).elements;
        let metas = elements.filter(el => el.name === "meta");

        expect(metas).toHaveLength(EXPECTED_META);
    });

    it("parses the correct number of section elements", () => {
        let elements = parse(FIXTURE_HTML).elements;
        let sections = elements.filter(el => el.name === "section");

        expect(sections).toHaveLength(EXPECTED_SECTION);
    });

    it("parses the correct number of list items", () => {
        let elements = parse(FIXTURE_HTML).elements;
        let listItems = elements.filter(el => el.name === "li");

        expect(listItems).toHaveLength(EXPECTED_LI);
    });

    it("extracts href attributes from anchor elements", () => {
        let elements = parse(FIXTURE_HTML).elements;
        let hrefs = elements
            .filter(el => el.name === "a")
            .map(el => el.getAttribute("href"))
            .filter((href): href is string => href !== null);

        expect(hrefs).toHaveLength(EXPECTED_A);
        expect(hrefs).toContain("/features");
        expect(hrefs).toContain("/signup");
    });

    it("extracts src attributes from img elements", () => {
        let elements = parse(FIXTURE_HTML).elements;
        let srcs = elements
            .filter(el => el.name === "img")
            .map(el => el.getAttribute("src"))
            .filter((src): src is string => src !== null);

        expect(srcs).toHaveLength(EXPECTED_IMG);
        expect(srcs).toContain("/images/logo.svg");
        expect(srcs).toContain("/images/hero-screenshot.png");
    });

    it("parses a simple HTML snippet correctly", () => {
        let elements = parse('<div class="test"><a href="/home">Home</a></div>').elements;

        expect(elements).toHaveLength(2);
        expect(elements[0]?.name).toBe("div");
        expect(elements[0]?.getAttribute("class")).toBe("test");
        expect(elements[1]?.name).toBe("a");
        expect(elements[1]?.getAttribute("href")).toBe("/home");
    });

    it("handles self-closing tags", () => {
        let elements = parse('<img src="/photo.jpg" /><br /><input type="text" />').elements;

        expect(elements).toHaveLength(3);
        expect(elements[0]?.name).toBe("img");
        expect(elements[0]?.getAttribute("src")).toBe("/photo.jpg");
        expect(elements[1]?.name).toBe("br");
        expect(elements[2]?.name).toBe("input");
        expect(elements[2]?.getAttribute("type")).toBe("text");
    });

    it("skips HTML comments", () => {
        let elements = parse("<!-- this is a comment --><div>content</div>").elements;

        expect(elements).toHaveLength(1);
        expect(elements[0]?.name).toBe("div");
    });

    it("handles boolean attributes", () => {
        let elements = parse('<input disabled required type="checkbox" />').elements;

        expect(elements).toHaveLength(1);
        expect(elements[0]?.getAttribute("disabled")).toBe("");
        expect(elements[0]?.getAttribute("required")).toBe("");
        expect(elements[0]?.getAttribute("type")).toBe("checkbox");
    });

    it("serializes the parsed tree instead of the flat element list", () => {
        let dom = parse('<div class="test"><a href="/home">Home</a></div>');

        expect(dom.toString()).toBe('<div class="test"><a href="/home">Home</a></div>');
    });

    it("serializes attribute and innerHTML mutations in place", () => {
        let dom = parse(
            '<main><link rel="modulepreload" href="/entry.tsx" /><script>import("/entry.tsx")</script><a href="/home">Home</a></main>',
        );
        let scripts = dom.elements.filter(
            el => el.name === "script" && el.getAttribute("src") === null,
        );
        let links = dom.elements.filter(
            el => el.name === "link" && el.getAttribute("href") !== null,
        );
        let anchors = dom.elements.filter(
            el => el.name === "a" && el.getAttribute("href") !== null,
        );

        scripts[0]!.innerHTML = scripts[0]!.innerHTML.replace("/entry.tsx", "/entry.js");
        links[0]!.setAttribute("href", "/entry.js");
        anchors[0]!.setAttribute("href", "/docs");

        expect(dom.toString()).toBe(
            '<main><link rel="modulepreload" href="/entry.js" /><script>import("/entry.js")</script><a href="/docs">Home</a></main>',
        );
    });

    it("preserves comments in the serialized tree when enabled", () => {
        let dom = parse("<div><!-- rmx:h:0 --><span>content</span><!-- /rmx:h --></div>", {
            comment: true,
        });

        expect(dom.toString()).toBe(
            "<div><!-- rmx:h:0 --><span>content</span><!-- /rmx:h --></div>",
        );
    });

    it("treats less-than signs in script bodies as raw text", () => {
        let dom = parse("<script>if (left < right) run();</script><div>content</div>");

        expect(dom.elements.map(el => el.name)).toEqual(["script", "div"]);
        expect(dom.elements[0]?.innerHTML).toBe("if (left < right) run();");
    });

    it("keeps greater-than signs in quoted attribute values", () => {
        let elements = parse('<a href="/search?q=a>b">Search</a>').elements;

        expect(elements).toHaveLength(1);
        expect(elements[0]?.getAttribute("href")).toBe("/search?q=a>b");
    });

    it("matches tag and attribute names case-insensitively", () => {
        let elements = parse('<DIV CLASS="x">content</DIV>').elements;

        expect(elements).toHaveLength(1);
        expect(elements[0]?.name).toBe("div");
        expect(elements[0]?.getAttribute("class")).toBe("x");
    });

    it("parses unquoted attribute values", () => {
        let elements = parse("<a href=/home>Home</a>").elements;

        expect(elements).toHaveLength(1);
        expect(elements[0]?.getAttribute("href")).toBe("/home");
    });

    it("escapes double quotes in serialized attribute values", () => {
        let dom = parse("<a>Home</a>");
        let anchor = dom.elements[0]!;

        anchor.setAttribute("title", 'She said "hello"');

        expect(dom.toString()).toBe('<a title="She said &quot;hello&quot;">Home</a>');
    });
});
