import type { CollectionEntry } from "@pitlane/content";

import type { content } from "#/content.ts";

/** One entry of each collection, named from the collection rather than its schema. */
export type PostEntry = CollectionEntry<(typeof content)["blog"]>;
export type AuthorEntry = CollectionEntry<(typeof content)["authors"]>;

/** The entry data each collection produces, inferred from its schema. */
export type Post = PostEntry["data"];
export type Author = AuthorEntry["data"];
