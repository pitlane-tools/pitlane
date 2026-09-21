import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";

// One collection, over a directory no other collection touches, so watching it
// can only come from asking the loader what it reads.
export let content = createContent(c => ({
    blog: c.collection({
        loader: loaders.glob({ pattern: "**/*.md", base: "app/later" }),
        schema: s.object({ title: s.string() }),
    }),
}));
