import { createContent } from "@pitlane/content";
import * as loaders from "@pitlane/content/loaders";
import * as s from "remix/data-schema";

// `options.satteri` configures the runtime rendering path, so prebuilding this
// collection makes the plugin list a no-op. The build must say so.
export let content = createContent(c => ({
    blog: c.collection({
        loader: loaders.glob({
            pattern: "**/*.md",
            base: "app/content/blog",
            satteri: { features: { math: true } },
        }),
        schema: s.object({ title: s.string() }),
    }),
}));
