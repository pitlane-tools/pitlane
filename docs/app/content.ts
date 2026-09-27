import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";

import { reference } from "./reference.ts";

let page = s.object({
    title: s.string(),
    description: s.string(),
    build: s.optional(s.enum_(["vite", "no-build"])),
});

/**
 * The published corpus: authored guides and deployment pages, and the API
 * reference `mise run docs:api` generates. Drafts and shared partials sit
 * outside these globs (`_`-prefixed files, `_partials/`), so they are
 * authoring inputs the build compiles into pages without ever becoming one.
 *
 * `contentLayer()` compiles every body during the build through the Sätteri
 * plugins the Vite config registers: MDX to a component, Markdown to HTML.
 * Paths resolve against the content root, the `docs` Vite root.
 */
export let content = createContent(c => ({
    guides: c.collection({
        loader: loaders.glob({ base: "./app/content/guides", pattern: "[!_]*.{md,mdx}" }),
        schema: page,
    }),
    deploy: c.collection({
        loader: loaders.glob({ base: "./app/content/deployment", pattern: "[!_]*.{md,mdx}" }),
        schema: page,
    }),
    api: c.collection({
        loader: reference({ manifest: "./.generated/reference.json", repository: ".." }),
        schema: s.object({
            url: s.string(),
            title: s.string(),
            description: s.string(),
            module: s.string(),
            kind: s.string(),
            aliases: s.array(s.object({ module: s.string(), name: s.string() })),
        }),
    }),
}));
