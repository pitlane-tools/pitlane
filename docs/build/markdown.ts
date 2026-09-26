import type { HastNode } from "satteri";

import { htmlToHast } from "satteri";

type Element = Extract<HastNode, { type: "element" }>;
type Content = Element["children"][number];

const ALERTS: Record<string, string> = {
    tip: "TIP",
    info: "NOTE",
    warning: "WARNING",
    danger: "CAUTION",
};
const DROPPED = new Set(["button", "form", "nav", "script", "style", "template"]);
const BLOCKS_IN_ITEMS = new Set(["p", "ul", "ol", "pre", "div", "blockquote", "aside", "table"]);
const ESCAPED = /[\\`*_[\]<]/g;

/**
 * The Markdown a rendered article means: the same text, links, examples, and
 * structure, with each documentation component written out the way a Markdown
 * reader would, rather than the MDX that produced it.
 */
export function htmlToMarkdown(html: string): string {
    let root = htmlToHast(html, { fragment: true });
    if (root.type !== "root") throw new Error("A fragment parse produced no root.");
    return `${blocks(root.children as Content[])}\n`;
}

function blocks(nodes: Content[]): string {
    let rendered = nodes.map(block).filter(text => text.length > 0);
    return rendered.join("\n\n");
}

function block(node: Content): string {
    if (node.type === "text") return node.value.trim() === "" ? "" : escape(node.value.trim());
    if (node.type !== "element" || DROPPED.has(node.tagName)) return "";
    if (hasProperty(node, "dataPagefindIgnore")) return "";

    if (hasProperty(node, "dataCallout")) return callout(node);

    switch (node.tagName) {
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
            return `${"#".repeat(Number(node.tagName[1]))} ${inline(node.children)}`;
        case "p":
            return inline(node.children);
        case "pre":
            return fence(node);
        case "details":
            return details(node);
        case "ul":
        case "ol":
            return list(node);
        case "blockquote":
            return quote(blocks(node.children));
        case "table":
            return table(node);
        case "hr":
            return "---";
        default:
            return blocks(node.children);
    }
}

function inline(nodes: Content[]): string {
    return nodes.map(phrase).join("").replace(/\s+/g, " ").trim();
}

function phrase(node: Content): string {
    if (node.type === "text") return escape(node.value);
    if (node.type !== "element") return "";

    let inner = () => node.children.map(phrase).join("");
    switch (node.tagName) {
        case "code":
            return codeSpan(textContent(node));
        case "strong":
        case "b":
            return `**${inner()}**`;
        case "em":
        case "i":
            return `_${inner()}_`;
        case "del":
            return `~~${inner()}~~`;
        case "br":
            return "\n";
        case "img":
            return `![${node.properties?.alt ?? ""}](${node.properties?.src ?? ""})`;
        case "a": {
            if (classList(node).includes("doc-heading__anchor")) return "";
            let text = inner();
            let href = node.properties?.href;
            return text && typeof href === "string" ? `[${text}](${href})` : text;
        }
        default:
            return inner();
    }
}

function codeSpan(text: string): string {
    let ticks = text.includes("`") ? "``" : "`";
    return `${ticks}${text}${ticks}`;
}

/**
 * A `<pre>`, fenced with the language the build recorded on it and any file-name title, and long
 * enough to hold any fence inside.
 */
function fence(node: Element): string {
    let { dataLanguage: language, dataTitle: title } = node.properties ?? {};
    let lines = descendants(node, element => classList(element).includes("ec-line"));
    let code = lines.length
        ? lines.map(line => textContent(line).replace(/\n$/, "")).join("\n")
        : textContent(node).replace(/\n$/, "");
    let longest = Math.max(0, ...(code.match(/`+/g) ?? []).map(run => run.length));
    let ticks = "`".repeat(Math.max(3, longest + 1));
    let info = [
        typeof language === "string" && language !== "text" ? language : "",
        typeof title === "string" ? `title=${JSON.stringify(title)}` : "",
    ]
        .filter(Boolean)
        .join(" ");
    return `${ticks}${info}\n${code}\n${ticks}`;
}

/**
 * A disclosure, open or not, as its summary in bold and then everything it
 * reveals; an install group is one per package manager, each under its name.
 */
function details(node: Element): string {
    let summary = node.children.find(
        (child): child is Element => child.type === "element" && child.tagName === "summary",
    );
    let heading = summary ? `**${inline(summary.children)}**` : "";
    let body = blocks(node.children.filter(child => child !== summary));
    return [heading, body].filter(Boolean).join("\n\n");
}

/** A callout as a GitHub alert: its kind, its title in bold, then its body. */
function callout(node: Element): string {
    let kind = String(node.properties?.dataCallout);
    let [title, ...body] = node.children.filter(
        child => child.type !== "text" || child.value.trim() !== "",
    );
    let heading = title ? `**${inline([title])}**` : "";
    return quote(
        [`[!${ALERTS[kind] ?? "NOTE"}]`, heading, blocks(body)].filter(Boolean).join("\n\n"),
    );
}

function quote(text: string): string {
    return text
        .split("\n")
        .map(line => (line ? `> ${line}` : ">"))
        .join("\n");
}

function list(node: Element): string {
    let ordered = node.tagName === "ol";
    let items = node.children.filter(
        (child): child is Element => child.type === "element" && child.tagName === "li",
    );
    // A tight list has no paragraphs in its items; its nested lists follow
    // their item on the next line, as the source wrote them.
    let loose = items.some(item =>
        item.children.some(child => child.type === "element" && child.tagName === "p"),
    );
    let separator = loose ? "\n\n" : "\n";
    return items
        .map((item, index) => {
            let marker = ordered ? `${index + 1}. ` : "- ";
            let [first, ...rest] = listItem(item);
            let tail = rest.map(part => indent(part, 4)).join(separator);
            return `${marker}${first ?? ""}${tail ? `${separator}${tail}` : ""}`;
        })
        .join(separator);
}

/** An item's parts: one run of phrasing, or the paragraphs and lists it holds. */
function listItem(item: Element): string[] {
    let phrasing: Content[] = [];
    let parts: string[] = [];
    for (let child of item.children) {
        let isBlock = child.type === "element" && BLOCKS_IN_ITEMS.has(child.tagName);
        if (!isBlock) {
            phrasing.push(child);
            continue;
        }
        let lead = inline(phrasing);
        if (lead) parts.push(lead);
        phrasing = [];
        parts.push(block(child));
    }
    let lead = inline(phrasing);
    if (lead) parts.push(lead);
    return parts.filter(Boolean);
}

function table(node: Element): string {
    let rows = descendants(node, row => row.tagName === "tr").map(row =>
        descendants(row, cell => cell.tagName === "th" || cell.tagName === "td").map(cell =>
            inline(cell.children).replace(/\|/g, "\\|"),
        ),
    );
    let [header, ...body] = rows;
    if (!header) return "";
    let line = (cells: string[]) => `| ${cells.join(" | ")} |`;
    return [line(header), line(header.map(() => "---")), ...body.map(line)].join("\n");
}

/** The outermost elements below `node` that `match` accepts. */
function descendants(node: Element, match: (element: Element) => boolean): Element[] {
    let found: Element[] = [];
    for (let child of node.children) {
        if (child.type !== "element") continue;
        if (match(child)) found.push(child);
        else found.push(...descendants(child, match));
    }
    return found;
}

/** Whether an element carries an attribute, which a hast tree spells in camel case (`data-callout` is `dataCallout`). */
function hasProperty(node: Element, name: string): boolean {
    return node.properties?.[name] != null;
}

function textContent(node: Content): string {
    if (node.type === "text") return node.value;
    if (node.type !== "element") return "";
    return node.children.map(textContent).join("");
}

function classList(node: Element): string[] {
    let classes = node.properties?.className ?? node.properties?.class;
    return Array.isArray(classes) ? classes.map(String) : String(classes ?? "").split(" ");
}

function indent(text: string, width: number): string {
    let padding = " ".repeat(width);
    return text
        .split("\n")
        .map(line => (line ? padding + line : line))
        .join("\n");
}

function escape(text: string): string {
    return text.replace(ESCAPED, "\\$&");
}
