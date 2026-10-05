import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";

let page = s.object({
    title: s.string(),
    description: s.string(),
    build: s.optional(s.enum_(["vite", "no-build"])),
});

/**
 * The authored collections: guides and deployment pages. Drafts and shared
 * partials sit outside these globs (`_`-prefixed files, `_partials/`), so
 * they are authoring inputs the build compiles into pages without ever
 * becoming one.
 *
 * Declared apart from `content.ts`, which adds the generated API reference,
 * so the installed documentation can compile these alone. Paths resolve
 * against the content root, the `docs` Vite root.
 */
export let authored = {
    guides: {
        loader: loaders.glob({ base: "./app/content/guides", pattern: "[!_]*.{md,mdx}" }),
        schema: page,
    },
    deploy: {
        loader: loaders.glob({ base: "./app/content/deployment", pattern: "[!_]*.{md,mdx}" }),
        schema: page,
    },
};
