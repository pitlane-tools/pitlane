import type { HastPluginEntry, HastVisitorContext } from "satteri";

type Component = "Vite" | "NoBuild" | "Include";

interface DocumentBindings {
    components: Map<string, Component>;
    documents: Map<string, string>;
}

const DOCUMENTATION = new URL("../app/components/documentation.tsx", import.meta.url).href;
const COMPONENTS: Component[] = ["Vite", "NoBuild", "Include"];
const EMPTY: DocumentBindings = { components: new Map(), documents: new Map() };

export function documentBindings(context: HastVisitorContext): DocumentBindings {
    return (context.data.documentationBindings as DocumentBindings | undefined) ?? EMPTY;
}

export function bindings(): HastPluginEntry {
    return () => ({
        name: "docs-bindings",
        mdxjsEsm(node, context) {
            let found = (context.data.documentationBindings ??= {
                components: new Map(),
                documents: new Map(),
            }) as DocumentBindings;
            let program = node.parseExpression();
            for (let statement of program?.body ?? []) {
                if (statement.type !== "ImportDeclaration") continue;
                let source = String(statement.source.value);
                let documentation =
                    context.fileURL && new URL(source, context.fileURL).href === DOCUMENTATION;
                for (let specifier of statement.specifiers) {
                    let local = specifier.local.name;
                    if (specifier.type === "ImportNamespaceSpecifier") {
                        if (documentation)
                            for (let component of COMPONENTS)
                                found.components.set(`${local}.${component}`, component);
                        continue;
                    }
                    let imported =
                        specifier.type === "ImportDefaultSpecifier"
                            ? "default"
                            : specifier.imported.type === "Identifier"
                              ? specifier.imported.name
                              : String(specifier.imported.value);
                    if (imported === "default" && /\.mdx?$/.test(source))
                        found.documents.set(local, source);
                    if (documentation && COMPONENTS.includes(imported as Component))
                        found.components.set(local, imported as Component);
                }
            }
        },
    });
}
