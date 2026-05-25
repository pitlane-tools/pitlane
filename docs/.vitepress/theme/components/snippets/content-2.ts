// @ts-nocheck
import { createContent } from "pitlane/content";
import * as loaders from "pitlane/content/loaders";
import * as s from "remix/data-schema";

export let content = await createContent(c => ({
    blog: c.collection({
        loader: loaders.glob({
            pattern: "app/content/**/*.{md,mdx}",
            base: "blog",
        }),
        schema: s.object({
            title: s.string(),
            summary: s.string(),
            publishedOn: s.date(),
            author: c.reference("authors"),
        }),
    }),
    authors: c.collection({
        loader: loaders.file(
            "app/content/authors.jsonc",
        ),
        schema: s.object({
            name: s.string(),
            avatar: s.string(),
        }),
    }),
}));
