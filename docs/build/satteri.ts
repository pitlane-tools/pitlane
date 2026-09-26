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

/** The documentation components whose children only one build mode shows. */
const VARIANTS: Record<string, BuildMode> = { Vite: "vite", NoBuild: "no-build" };

/** The export `headings()` from `@pitlane/content/satteri` appends to an MDX document. */
const HEADINGS_EXPORT = /^export const headings = /;

/**
 * One step of a document's outline, in document order: a heading of its own,
 * or every heading of a document it includes.
 */
export type OutlineItem =
    | { heading: CompiledHeading }
    | { include: { specifier: string; buildMode?: BuildMode } };

/**
 * Gives every heading a permalink to itself and settles the document's
 * outline: a heading inside a `<Vite>` or `<NoBuild>` section carries that
 * build mode, and an `<Include document={binding} />` stands for the headings
 * of the document `binding` was default-imported from.
 *
 * Runs after `headings()` from `@pitlane/content/satteri`, which gives each
 * heading its `id` and, on MDX, exports the flat heading list. This plugin
 * rewrites that export so `entry.render()` hands back the outline with its
 * variants and includes resolved: each include becomes an import of the
 * included module's own `headings`, spliced in where the include stood.
 * Markdown has no variants or includes, so its list is left as it is.
 */
export function outline(): HastPluginEntry {
    return () => {
        let items: OutlineItem[] = [];

        let definition: HastPluginDefinition = {
            name: "docs-outline",
            element: {
                filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
                visit(node, context) {
                    let slug = node.properties?.id;
                    if (typeof slug !== "string") {
                        throw new Error(
                            `${where(context, node)} has a heading without an id: run headings() from ` +
                                "@pitlane/content/satteri before outline().",
                        );
                    }
                    let text = context.textContent(node).replace(/\s+/g, " ").trim();
                    context.appendChild(node, {
                        type: "element",
                        tagName: "a",
                        properties: {
                            class: "doc-heading__anchor",
                            href: `#${slug}`,
                            "aria-label": `Link to ${text}`,
                        },
                        children: [],
                    });
                    let heading: CompiledHeading = {
                        depth: Number(node.tagName.slice(1)),
                        slug,
                        text,
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
            after(root, context) {
                context.data.outline = items;
                if (context.sourceFormat !== "mdx") return;
                let flat = root.children.find(
                    child => child.type === "mdxjsEsm" && HEADINGS_EXPORT.test(child.value),
                );
                if (!flat) {
                    throw new Error(
                        `${where(context)} exports no headings: run headings() from ` +
                            "@pitlane/content/satteri before outline().",
                    );
                }
                context.replaceNode(flat, { type: "mdxjsEsm", value: outlineModule(items) });
            },
        };
        return definition;
    };
}

/**
 * The outline as ESM. An included document's headings are spliced in where
 * its `<Include>` stood; inside a `<Vite>` or `<NoBuild>` section they take
 * that build mode, and those belonging to the other one drop out.
 */
function outlineModule(items: OutlineItem[]): string {
    let imports: string[] = [];
    let entries = items.map(item => {
        if ("heading" in item) return JSON.stringify(item.heading);
        let binding = `included${imports.length}`;
        imports.push(
            `import { headings as ${binding} } from ${JSON.stringify(item.include.specifier)};`,
        );
        let mode = item.include.buildMode;
        if (!mode) return `...${binding}`;
        return (
            `...${binding}.flatMap(heading => heading.buildMode && heading.buildMode !== ${JSON.stringify(mode)} ` +
            `? [] : [{ ...heading, buildMode: ${JSON.stringify(mode)} }])`
        );
    });
    return `${imports.join("\n")}\nexport const headings = [${entries.join(",\n")}];`;
}

/**
 * Renders every fenced example as finished Expressive Code during the build,
 * so rendering a document highlights nothing. In MDX the block becomes an
 * element carrying the HTML; in Markdown, which compiles to HTML, it is
 * spliced in as it is.
 */
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
                let html = await renderCode(text, language, where(context, node));
                if (context.sourceFormat !== "mdx") return { type: "raw", value: html };
                return {
                    type: "mdxJsxFlowElement",
                    name: "div",
                    attributes: [{ type: "mdxJsxAttribute", name: "innerHTML", value: html }],
                    children: [],
                };
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
