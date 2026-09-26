import type {
    HastNode,
    HastPluginDefinition,
    HastPluginEntry,
    HastVisitorContext,
    MdxJsxAttributeNode as MdxJsxAttribute,
} from "satteri";

import { fileURLToPath } from "node:url";

import type { BuildMode, CompiledHeading } from "../app/document.ts";

import { documentBindings } from "./bindings.ts";
import { renderCode } from "./expressive-code.ts";

type Element = Extract<HastNode, { type: "element" }>;

const CONTROL = /[\u0000-\u001f]/g;
const SPECIAL = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g;
const COMBINING = /[\u0300-\u036F]/g;

/** The documentation components whose children only one build mode shows. */
const VARIANTS: Record<string, BuildMode> = { Vite: "vite", NoBuild: "no-build" };

/**
 * One step of a document's outline, in document order: a heading of its own,
 * or every heading of a document it includes.
 */
export type OutlineItem =
    | { heading: CompiledHeading }
    | { include: { specifier: string; buildMode?: BuildMode } };

/**
 * The slug VitePress gave a heading, kept so every anchor that reached the old
 * site still lands: NFKD, marks and control characters dropped, runs of
 * punctuation and whitespace collapsed to one dash, a leading digit prefixed.
 */
export function slugify(text: string): string {
    return text
        .normalize("NFKD")
        .replace(COMBINING, "")
        .replace(CONTROL, "")
        .replace(SPECIAL, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/^(\d)/, "_$1")
        .toLowerCase();
}

/**
 * Gives every heading the id its anchor links use and a permalink to itself,
 * and records the document's outline as `data.outline`.
 *
 * A repeated slug takes `-1`, `-2`, … in document order. A heading inside a
 * `<Vite>` or `<NoBuild>` section carries that build mode, and an
 * `<Include document={binding} />` stands for the headings of the document
 * `binding` was default-imported from, so a two-mode guide's outline is
 * settled here rather than by rendering either variant.
 */
export function outline(): HastPluginEntry {
    return () => {
        let taken = new Set<string>();
        let items: OutlineItem[] = [];

        let definition: HastPluginDefinition = {
            name: "docs-outline",
            element: {
                filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
                visit(node, context) {
                    let text = context.textContent(node).replace(/\s+/g, " ").trim();
                    let base = slugify(text);
                    let id = base;
                    for (let suffix = 1; taken.has(id); suffix++) id = `${base}-${suffix}`;
                    taken.add(id);

                    context.setProperty(node, "id", id);
                    context.appendChild(node, {
                        type: "element",
                        tagName: "a",
                        properties: {
                            class: "doc-heading__anchor",
                            href: `#${id}`,
                            "aria-label": `Link to ${text}`,
                        },
                        children: [],
                    });
                    let heading: CompiledHeading = {
                        id,
                        text,
                        level: Number(node.tagName.slice(1)),
                    };
                    let buildMode = variantOf(node, context);
                    if (buildMode === false) return;
                    if (buildMode) heading.buildMode = buildMode;
                    items.push({ heading });
                },
            },
            mdxJsxFlowElement: {
                filter: [],
                visit(node, context) {
                    let bindings = documentBindings(context);
                    if (!node.name || bindings.components.get(node.name) !== "Include") return;
                    let buildMode = variantOf(node, context);
                    if (buildMode === false) return;
                    let binding = node.attributes.find(
                        (attribute): attribute is MdxJsxAttribute =>
                            attribute.type === "mdxJsxAttribute" && attribute.name === "document",
                    )?.value;
                    let name =
                        typeof binding === "object" && binding ? binding.value.trim() : undefined;
                    let specifier = name === undefined ? undefined : bindings.documents.get(name);
                    if (!specifier) {
                        throw new Error(
                            `${where(context)} has an <Include> whose document is not a default import of a ` +
                                `.md or .mdx file. Write \`import guide from "./guide.mdx"\` and ` +
                                `\`<Include document={guide} />\`.`,
                        );
                    }
                    items.push({ include: buildMode ? { specifier, buildMode } : { specifier } });
                },
            },
            after(_root, context) {
                context.data.outline = items;
            },
        };
        return definition;
    };
}

/** Compile authored fences to static HTML; Expressive Code owns their browser enhancement. */
export function codeBlocks(): HastPluginEntry {
    let definition: HastPluginDefinition = {
        name: "docs-code-blocks",
        options: { position: true },
        element: {
            filter: ["pre"],
            async visit(node, context) {
                let fenced = example(node, context);
                if (!fenced) return;

                let { text, language } = fenced;
                return {
                    type: "mdxJsxFlowElement",
                    name: "div",
                    attributes: [
                        {
                            type: "mdxJsxAttribute",
                            name: "innerHTML",
                            value: await renderCode(text, language, where(context, node)),
                        },
                    ],
                    children: [],
                };
            },
        },
    };
    return definition;
}

/**
 * Replaces every fenced example in a generated reference page with the
 * Expressive Code block rendered for it now, during the build, spliced in as
 * finished HTML. The page is published as that HTML, so its examples are
 * neither components nor hydrated.
 */
export function referenceCode(): HastPluginEntry {
    let definition: HastPluginDefinition = {
        name: "docs-reference-code",
        element: {
            filter: ["pre"],
            async visit(node, context) {
                let fenced = example(node, context);
                if (!fenced) return;

                let { text, language } = fenced;
                let html = await renderCode(text, language, where(context, node));
                return { type: "raw", value: html };
            },
        },
    };
    return definition;
}

/**
 * A fenced example's exact text, without the fence's closing newline, and the
 * language the fence named; nothing for a `<pre>` that holds no `<code>`.
 */
function example(
    pre: Element,
    context: HastVisitorContext,
): { text: string; language: string | undefined } | undefined {
    let code = pre.children.find(
        (child): child is Element => child.type === "element" && child.tagName === "code",
    );
    if (!code) return undefined;
    return { text: context.textContent(code).replace(/\n$/, ""), language: languageOf(code) };
}

/** Conflicting ancestor variants cannot render in either mode. */
function variantOf(node: HastNode, context: HastVisitorContext): BuildMode | false | undefined {
    let bindings = documentBindings(context);
    let selected: BuildMode | undefined;
    for (let parent = context.parent(node); parent; parent = context.parent(parent)) {
        if (parent.type !== "mdxJsxFlowElement" || !parent.name) continue;
        let component = bindings.components.get(parent.name);
        let mode = component && VARIANTS[component];
        if (!mode) continue;
        if (selected && selected !== mode) return false;
        selected = mode;
    }
    return selected;
}

/** The language a fence named, which the compiler left as a `language-*` class. */
function languageOf(code: Element): string | undefined {
    let classes = code.properties?.className ?? code.properties?.class;
    let list = Array.isArray(classes) ? classes.map(String) : String(classes ?? "").split(" ");
    return list.find(name => name.startsWith("language-"))?.slice("language-".length);
}

/** Where a node is: its document, and the line and column when the compile tracks positions. */
function where(context: HastVisitorContext, node?: Readonly<HastNode>): string {
    let file = context.fileURL ? fileURLToPath(context.fileURL) : "A document";
    let start = node?.position?.start;
    return start ? `${file}:${start.line}:${start.column}` : file;
}
