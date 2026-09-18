import type { CollectionEntry } from "@pitlane/content";

import type { content } from "#/content.ts";

type Collections = Awaited<typeof content>;
type EntryOf<C extends keyof Collections> = Awaited<
    ReturnType<Collections[C]["getCollection"]>
>[number];

/** The entry data each collection produces, inferred from its schema. */
export type Post = EntryOf<"blog">["data"];
export type Author = EntryOf<"authors">["data"];

export type PostEntry = CollectionEntry<Post>;
export type AuthorEntry = CollectionEntry<Author>;
