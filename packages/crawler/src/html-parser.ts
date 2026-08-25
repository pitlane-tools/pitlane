/**
 * A deliberately small HTML parser. It exists to pull link and asset hrefs out
 * of a rendered document and to serialize the tree back with attribute edits
 * applied. It implements no CSS selectors, no DOM API, and no error recovery
 * beyond what a well-formed server render needs, which is what makes it a few
 * times faster than a general-purpose parser on the same documents.
 *
 * Internal to this package: {@link crawl} is the public surface.
 */

/** The subset of a DOM element the crawler reads and writes. */
export interface HTMLElement {
    name: string;
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    innerHTML: string;
}

export interface ParseOptions {
    /**
     * Keep comment nodes in the serialized output. Off by default because the
     * crawler only reads elements; turn it on before round-tripping a document
     * whose comments carry meaning, such as Remix UI's hydration markers.
     */
    comment?: boolean;
}

const VOID_ELEMENTS = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);

const RAW_TEXT_ELEMENTS = new Set(["script", "style"]);

type HtmlNode = Element | string;

class Element implements HTMLElement {
    name: string;
    #attributes = new Map<string, string>();
    #children: HtmlNode[] = [];
    #selfClosing: boolean;

    constructor(name: string, selfClosing = false) {
        this.name = name.toLowerCase();
        this.#selfClosing = selfClosing;
    }

    setAttribute(name: string, value: string): void {
        this.#attributes.set(name.toLowerCase(), value);
    }

    getAttribute(name: string): string | null {
        return this.#attributes.get(name.toLowerCase()) ?? null;
    }

    get innerHTML(): string {
        return serialize(this.#children);
    }

    set innerHTML(value: string) {
        this.#children = [value];
    }

    appendChild(child: HtmlNode): void {
        this.#children.push(child);
    }

    isSelfClosing(): boolean {
        return this.#selfClosing;
    }

    toString(): string {
        if (this.name === "#comment") return this.#attributes.get("text") ?? "";

        let attrs = Array.from(this.#attributes.entries())
            .map(([key, value]) =>
                value === "" ? key : `${key}="${value.replace(/"/g, "&quot;")}"`,
            )
            .join(" ");
        let attrString = attrs ? ` ${attrs}` : "";

        if (this.name.startsWith("!")) return `<${this.name}${attrString}>`;
        if (VOID_ELEMENTS.has(this.name) || this.#selfClosing) {
            return `<${this.name}${attrString} />`;
        }

        return `<${this.name}${attrString}>${serialize(this.#children)}</${this.name}>`;
    }
}

/** A parsed document: the flat element list, plus the tree for serialization. */
export class Document {
    #elements: HTMLElement[];
    #children: HtmlNode[];

    constructor(elements: HTMLElement[], children: HtmlNode[]) {
        this.#elements = elements;
        this.#children = children;
    }

    /** Every element in the document, in source order. */
    get elements(): HTMLElement[] {
        return this.#elements;
    }

    toString(): string {
        return serialize(this.#children);
    }
}

function serialize(children: HtmlNode[]): string {
    return children.map(child => (typeof child === "string" ? child : child.toString())).join("");
}

/**
 * Index of the `>` that closes the tag opening at `start`, skipping any `>`
 * inside a quoted attribute value. Returns -1 when the tag never closes.
 */
function findTagEnd(html: string, start: number): number {
    let quote: string | null = null;

    for (let i = start; i < html.length; i++) {
        let char = html[i];
        if (char === undefined) break;

        if (quote) {
            if (char === quote) quote = null;
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }

        if (char === ">") return i;
    }

    return -1;
}

function parseTag(content: string): Element | null {
    let source = content.trim();
    let selfClosing = false;

    if (source.endsWith("/")) {
        selfClosing = true;
        source = source.slice(0, -1).trimEnd();
    }

    let nameEnd = 0;
    while (nameEnd < source.length && !/\s/.test(source[nameEnd] ?? "")) nameEnd++;

    let name = source.slice(0, nameEnd);
    if (!name) return null;

    let element = new Element(name, selfClosing);
    let i = nameEnd;

    while (i < source.length) {
        while (i < source.length && /\s/.test(source[i] ?? "")) i++;
        if (i >= source.length) break;

        let attrNameStart = i;
        while (i < source.length && !/[\s=]/.test(source[i] ?? "")) i++;
        let attrName = source.slice(attrNameStart, i);
        if (!attrName) break;

        while (i < source.length && /\s/.test(source[i] ?? "")) i++;

        if (source[i] !== "=") {
            element.setAttribute(attrName, "");
            continue;
        }

        i++;
        while (i < source.length && /\s/.test(source[i] ?? "")) i++;

        let quote = source[i];
        if (quote === '"' || quote === "'") {
            i++;
            let valueStart = i;
            while (i < source.length && source[i] !== quote) i++;
            element.setAttribute(attrName, source.slice(valueStart, i));
            if (source[i] === quote) i++;
            continue;
        }

        let valueStart = i;
        while (i < source.length && !/\s/.test(source[i] ?? "")) i++;
        element.setAttribute(attrName, source.slice(valueStart, i));
    }

    return element;
}

/**
 * Parses an HTML document into a flat element list and a serializable tree.
 *
 * @param html The document source.
 * @param options Parse options.
 * @returns The parsed document.
 */
export function parse(html: string, options?: ParseOptions): Document {
    let elements: HTMLElement[] = [];
    let children: HtmlNode[] = [];
    let stack: Element[] = [];
    let i = 0;

    let appendChild = (child: HtmlNode) => {
        let parent = stack.at(-1);
        if (parent) parent.appendChild(child);
        else children.push(child);
    };

    let appendElement = (element: Element) => {
        elements.push(element);
        appendChild(element);
    };

    // Unclosed tags are common in real documents, so close the nearest open
    // element with a matching name and drop everything opened inside it.
    let closeElement = (name: string) => {
        let normalized = name.toLowerCase();
        for (let index = stack.length - 1; index >= 0; index--) {
            if (stack[index]?.name === normalized) {
                stack.length = index;
                return;
            }
        }
    };

    while (i < html.length) {
        let lt = html.indexOf("<", i);
        if (lt === -1) {
            appendChild(html.slice(i));
            break;
        }

        if (lt > i) appendChild(html.slice(i, lt));

        if (html.startsWith("<!--", lt)) {
            let end = html.indexOf("-->", lt + 4);
            if (end === -1) {
                appendChild(html.slice(lt));
                break;
            }

            if (options?.comment) {
                let comment = new Element("#comment");
                comment.setAttribute("text", html.slice(lt, end + 3));
                appendElement(comment);
            }
            i = end + 3;
            continue;
        }

        if (html[lt + 1] === "/") {
            let end = findTagEnd(html, lt + 2);
            if (end === -1) {
                appendChild(html.slice(lt));
                break;
            }

            let tagName = html
                .slice(lt + 2, end)
                .trim()
                .split(/\s+/, 1)[0];
            if (tagName) closeElement(tagName);
            i = end + 1;
            continue;
        }

        let end = findTagEnd(html, lt + 1);
        if (end === -1) {
            appendChild(html.slice(lt));
            break;
        }

        let element = parseTag(html.slice(lt + 1, end));
        if (!element) {
            appendChild(html.slice(lt, end + 1));
            i = end + 1;
            continue;
        }

        appendElement(element);
        i = end + 1;

        if (
            element.name.startsWith("!") ||
            VOID_ELEMENTS.has(element.name) ||
            element.isSelfClosing()
        ) {
            continue;
        }

        // Everything up to the closing tag of a <script> or <style> is text,
        // not markup: a `<` inside either one does not open an element.
        if (RAW_TEXT_ELEMENTS.has(element.name)) {
            let closeStart = html.toLowerCase().indexOf(`</${element.name}`, i);
            if (closeStart === -1) {
                element.appendChild(html.slice(i));
                break;
            }

            element.appendChild(html.slice(i, closeStart));
            let closeEnd = findTagEnd(html, closeStart + 2);
            if (closeEnd === -1) break;
            i = closeEnd + 1;
            continue;
        }

        stack.push(element);
    }

    return new Document(elements, children);
}
