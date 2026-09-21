import { createContent } from "@pitlane/content";
import { hotContent } from "@pitlane/content/hot";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

export let content = createContent(c => ({
    blog: c.collection({
        loader: loaders.glob({ pattern: "**/*.{md,mdx}", base: "app/content/blog" }),
        schema: s.object({
            title: s.string(),
            summary: s.string(),
            publishedOn: coerce.date(),
            author: c.reference("authors"),
        }),
    }),
    authors: c.collection({
        loader: loaders.file("app/content/authors.json"),
        schema: s.object({ name: s.string(), bio: s.string() }),
    }),
}));

// A no-op unless `remix/node-hmr` is supervising: under `vp` the collections
// are prebuilt and Vite watches them, and in production nothing watches at all.
await hotContent(content);
