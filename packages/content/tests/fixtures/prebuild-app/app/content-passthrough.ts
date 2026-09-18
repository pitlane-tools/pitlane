import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";

/** Passes data through untouched, so nothing narrows what reaches the manifest. */
let anything = {
    "~standard": {
        version: 1 as const,
        vendor: "prebuild-app",
        validate: (value: unknown) => ({ value: value as Record<string, unknown> }),
    },
};

export let content = await createContent(c => ({
    settings: c.collection({
        loader: loaders.glob({ pattern: "*.json", base: "app/content/data" }),
        schema: anything,
    }),
    // Markdown and MDX, so a comparison can reach a rendered body and its
    // heading list rather than stopping at an entry's data.
    pages: c.collection({
        loader: loaders.glob({ pattern: "*.{md,mdx}", base: "app/content/pages" }),
        schema: anything,
    }),
}));
