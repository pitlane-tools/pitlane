// @ts-nocheck
import { createContent, getEntries } from "pitlane/content";
import * as loaders from "pitlane/content/loaders";
import * as s from "remix/data-schema";

export let content = await createContent({
    contentDir: "app/content",
    jsxImportSource: "remix/ui",
    watch: process.env.NODE_ENV === "development",
    collections: c => ({
        blog: {
            loader: loaders.glob({ pattern: "**/*.mdx", base: "blog" }),
            schema: s.object({
                title: s.string(),
                summary: s.string(),
                publishedOn: s.date(),
                author: c.reference("authors"),
            }),
        },
        authors: {
            loader: loaders.file("authors.json"),
            schema: s.object({ name: s.string(), avatar: s.string() }),
        },
    }),
});
