import { type ContentLoader, createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";

import { reference } from "./reference.ts";

let page = s.object({
    title: s.string(),
    description: s.string(),
    build: s.optional(s.enum_(["vite", "no-build"])),
});

/**
 * A loader whose entries keep their identity and validated frontmatter but
 * not their bodies.
 *
 * `contentLayer()` compiles a Markdown body to an HTML string, and a string
 * cannot hold the `CodeBlock` component a fenced example becomes. The build
 * compiles every body into a component module instead (`build/compile.ts`),
 * which `documents.ts` imports by path; keeping the body here as well would
 * put each page in the Worker twice.
 */
function metadata(loader: ContentLoader): ContentLoader {
    return {
        ...loader,
        load: context =>
            loader.load({
                ...context,
                store: { set: ({ id, data }) => context.store.set({ id, data }) },
            }),
    };
}

/**
 * The published corpus: authored guides and deployment pages, and the API
 * reference `mise run docs:api` generates. Drafts and shared partials sit
 * outside these globs (`_`-prefixed files, `docs/_partials/`), so they are
 * authoring inputs the build compiles into pages without ever becoming one.
 *
 * Paths resolve against the content root, the `.docs` Vite root.
 */
export let content = createContent(c => ({
    guides: c.collection({
        loader: metadata(loaders.glob({ base: "../docs/guides", pattern: "[!_]*.{md,mdx}" })),
        schema: page,
    }),
    deploy: c.collection({
        loader: metadata(loaders.glob({ base: "../docs/deploy", pattern: "[!_]*.{md,mdx}" })),
        schema: page,
    }),
    api: c.collection({
        loader: reference({ manifest: "../docs/.generated/reference.json", repository: ".." }),
        schema: s.object({
            url: s.string(),
            title: s.string(),
            description: s.string(),
            module: s.string(),
            kind: s.string(),
            source: s.string(),
            aliases: s.array(s.object({ module: s.string(), name: s.string() })),
        }),
    }),
}));
