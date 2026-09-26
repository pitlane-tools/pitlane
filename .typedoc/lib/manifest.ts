import type { DeclarationReflection } from "typedoc";
import type { MarkdownRenderer, MarkdownTheme } from "typedoc-plugin-markdown";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MarkdownPageEvent, MarkdownRendererEvent } from "typedoc-plugin-markdown";

import type { SymbolRouter } from "./router.ts";

import { KIND_SEGMENTS } from "./router.ts";

/** One page's document in `docs/.generated/reference.json`. */
export interface ReferenceEntry {
    url: string;
    title: string;
    description: string;
    module: string;
    kind: string | undefined;
    sourcePath: string;
    aliases: { module: string; name: string }[];
}

// While it renders, the renderer holds the pitlane theme and router, which
// base.json pairs, and every page that router builds belongs to a module, the
// project, or a declaration: all rendered as declaration pages by the theme.
interface PitlaneRenderer extends MarkdownRenderer {
    router: SymbolRouter;
    theme: MarkdownTheme;
}
type DeclarationPage = MarkdownPageEvent<DeclarationReflection>;

// Each `docs:api` run documents one package, so the site-wide files are
// merged: a run replaces every entry under its own URL prefix and leaves the
// other packages' entries alone.
export function writeSiteManifests(renderer: MarkdownRenderer): void {
    let pages: ReferenceEntry[] = [];
    renderer.on(MarkdownPageEvent.END, page => {
        pages.push(referenceEntry(renderer as PitlaneRenderer, page as DeclarationPage));
    });
    renderer.on(MarkdownRendererEvent.END, () => {
        let { router } = renderer as PitlaneRenderer;
        let { layout } = router;
        let owned = (url: string) => url.startsWith(`${layout.publicPath}/`);

        let entries = merge(
            readJson<ReferenceEntry[]>(layout.manifest, []),
            owned,
            pages.splice(0),
            entry => entry.url,
        );
        writeJson(layout.manifest, entries);

        let redirectsFile = path.join(path.dirname(layout.manifest), "reference-redirects.json");
        let redirects = merge(
            Object.entries(readJson<Record<string, string>>(redirectsFile, {})),
            owned,
            movedModules(router),
            ([from]) => from,
        );
        writeJson(redirectsFile, Object.fromEntries(redirects));
    });
}

function referenceEntry(renderer: PitlaneRenderer, page: DeclarationPage): ReferenceEntry {
    let { router, theme } = renderer;
    let { layout, modules } = router;
    let { model } = page;
    let module = modules.get(model);
    let comment = model.comment ?? model.signatures?.[0]?.comment;
    let description = comment
        ? theme.getRenderContext(page).helpers.getDescriptionForComment(comment)
        : null;
    return {
        url: layout.urlOf(page.url),
        title: module ? module.name : model.name,
        description: description ?? "",
        module: (module ?? modules.canonical(model)).name,
        kind: module ? "module" : KIND_SEGMENTS.get(model.kind),
        sourcePath: layout.sourcePathOf(page.url),
        aliases: module
            ? []
            : modules
                  .aliasesOf(model)
                  .map(alias => ({ module: alias.module.name, name: alias.name })),
    };
}

// [old path, new path] for every module whose page used to live elsewhere,
// such as a root module the old router had to suffix.
function movedModules(router: SymbolRouter): [string, string][] {
    let { layout, legacy, modules } = router;
    return modules
        .all()
        .map(({ reflection }): [string | undefined, string] => [
            legacy.fullUrls.get(reflection),
            router.getFullUrl(reflection),
        ])
        .filter(([before, after]) => before && before !== after)
        .map(([before, after]): [string, string] => [layout.urlOf(before!), layout.urlOf(after)]);
}

function merge<T>(
    existing: T[],
    owned: (key: string) => boolean,
    items: T[],
    keyOf: (item: T) => string,
): T[] {
    let kept = existing.filter(item => !owned(keyOf(item)));
    return [...kept, ...items].sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : 1));
}

function readJson<T>(file: string, fallback: T): T {
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback;
}

function writeJson(file: string, value: unknown): void {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
