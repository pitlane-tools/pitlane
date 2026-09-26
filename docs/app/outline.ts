import type { CompiledHeading, DocumentPage, Heading } from "./document.ts";

/**
 * The outline a page shows: the headings of its own variant, below the title,
 * checked for the mistakes an author can make across variants and includes.
 */
export function outline(
    page: Omit<DocumentPage, "headings">,
    compiled: CompiledHeading[],
    source: string,
): Heading[] {
    let stray = compiled.find(heading => heading.buildMode && !page.buildMode);
    if (stray) {
        throw new Error(
            `${source} has a ${stray.buildMode === "vite" ? "<Vite>" : "<NoBuild>"} section ("${stray.text}") ` +
                `but declares no "build:" in its frontmatter. Add "build: vite" or "build: no-build".`,
        );
    }
    let shown = compiled.filter(
        heading => !heading.buildMode || heading.buildMode === page.buildMode,
    );
    let destinations = new Set<string>();
    for (let heading of shown) {
        if (destinations.has(heading.slug)) {
            throw new Error(
                `${source} repeats heading destination "#${heading.slug}". Rename a heading or remove the repeated include.`,
            );
        }
        destinations.add(heading.slug);
    }
    if (!shown.some(heading => heading.depth === 1)) {
        throw new Error(
            `${source} has no top-level heading. Start its body with "# ${page.title}".`,
        );
    }
    return shown
        .filter(heading => heading.depth > 1)
        .map(({ slug, text, depth }) => ({ id: slug, text, level: depth }));
}
