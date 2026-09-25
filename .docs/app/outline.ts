import type { CompiledHeading, DocumentPage, Heading } from "./document.ts";

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
        if (destinations.has(heading.id)) {
            throw new Error(
                `${source} repeats heading destination "#${heading.id}". Rename a heading or remove the repeated include.`,
            );
        }
        destinations.add(heading.id);
    }
    if (!shown.some(heading => heading.level === 1)) {
        throw new Error(
            `${source} has no top-level heading. Start its body with "# ${page.title}".`,
        );
    }
    return shown
        .filter(heading => heading.level > 1)
        .map(({ id, text, level }) => ({ id, text, level }));
}
