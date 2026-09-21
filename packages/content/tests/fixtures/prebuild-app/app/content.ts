import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

export let content = createContent(c => ({
    blog: c.collection({
        loader: loaders.glob({ pattern: "**/*.{md,mdx}", base: "app/content/blog" }),
        schema: s.object({
            title: s.string(),
            publishedOn: coerce.date(),
            author: c.reference("authors"),
        }),
    }),
    authors: c.collection({
        loader: loaders.file("app/content/authors.json"),
        schema: s.object({ name: s.string() }),
    }),
    // A live loader: the build has no `load` to call, so it must stay out of
    // the manifest and keep running per read.
    ticker: c.collection({
        loader: {
            name: "ticker",
            async loadCollection() {
                return [{ id: "now", data: { name: "live" } }];
            },
            async loadEntry(id) {
                return id === "now" ? { id, data: { name: "live" } } : undefined;
            },
        },
        schema: s.object({ name: s.string() }),
    }),
}));
