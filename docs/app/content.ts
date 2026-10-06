import { createContent } from "@pitlane/content";
import * as s from "remix/data-schema";

import { authored } from "./authored.ts";
import { reference } from "./reference.ts";

/**
 * The published corpus: the authored guides and deployment pages, and the
 * API reference `vp run docs:api` generates.
 *
 * `contentLayer()` compiles every body during the build through the Sätteri
 * plugins the Vite config registers: MDX to a component, Markdown to HTML.
 * Paths resolve against the content root, the `docs` Vite root.
 */
export let content = createContent(c => ({
    ...authored,
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
