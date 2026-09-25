import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MarkdownPageEvent, MarkdownRendererEvent } from "typedoc-plugin-markdown";

import { KIND_SEGMENTS } from "./router.mjs";

// Each `docs:api` run documents one package, so the site-wide files are
// merged: a run replaces every entry under its own URL prefix and leaves the
// other packages' entries alone.
export function writeSiteManifests(renderer) {
    let pages = [];
    renderer.on(MarkdownPageEvent.END, page => {
        pages.push(referenceEntry(renderer, page));
    });
    renderer.on(MarkdownRendererEvent.END, () => {
        let { router } = renderer;
        let { layout } = router;
        let owned = url => url.startsWith(`${layout.publicPath}/`);

        let entries = merge(
            readJson(layout.manifest, []),
            owned,
            pages.splice(0),
            entry => entry.url,
        );
        writeJson(layout.manifest, entries);

        let redirectsFile = path.join(path.dirname(layout.manifest), "reference-redirects.json");
        let redirects = merge(
            Object.entries(readJson(redirectsFile, {})),
            owned,
            movedModules(router),
            ([from]) => from,
        );
        writeJson(redirectsFile, Object.fromEntries(redirects));
    });
}

function referenceEntry(renderer, page) {
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
function movedModules(router) {
    let { layout, legacy, modules } = router;
    return modules
        .all()
        .map(({ reflection }) => [legacy.fullUrls.get(reflection), router.getFullUrl(reflection)])
        .filter(([before, after]) => before && before !== after)
        .map(([before, after]) => [layout.urlOf(before), layout.urlOf(after)]);
}

function merge(existing, owned, items, keyOf) {
    let kept = existing.filter(item => !owned(keyOf(item)));
    return [...kept, ...items].sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : 1));
}

function readJson(file, fallback) {
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback;
}

function writeJson(file, value) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
