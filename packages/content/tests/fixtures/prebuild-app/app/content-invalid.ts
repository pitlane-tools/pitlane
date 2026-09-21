import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";

export let content = createContent(c => ({
    blog: c.collection({
        loader: loaders.glob({ pattern: "hello.md", base: "app/content/blog" }),
        // `hello.md` has no `heroImage`, so prebuilding it must fail the build.
        schema: s.object({ title: s.string(), heroImage: s.string() }),
    }),
}));
