// The module tags here and in the other entry files stay unnamed: the
// reference derives redirects for the old module pages from file-derived
// module names, and naming a module changes that derivation.
/**
 * Schema-validated, cross-referenced content collections for Remix 3.
 *
 * {@link createContent} declares collections of Markdown, MDX, JSON, and
 * YAML entries, each read by a loader from `@pitlane/content/loaders` and
 * validated by a Standard Schema, and returns a client a controller queries
 * with `getCollection()` and `getEntry()`. The entry types come from the
 * schemas, with nothing generated.
 *
 * @see {@link https://pitlane.tools/guides/content | Content guide}
 * @see {@link https://pitlane.tools/guides/content-no-build | Content guide, without a build}
 *
 * @module
 */
export { createContent } from "./content.ts";
export type {
    Collection,
    CollectionDefinition,
    CollectionEntry,
    Entry,
    Content,
    ContentBuilder,
    ContentLoader,
    EntryBody,
    GenerateIdOptions,
    Heading,
    LiveEntry,
    LiveLoader,
    LoadedEntry,
    Loader,
    LoaderContext,
    Reference,
    ReferenceSchema,
    RenderedEntry,
} from "./types.ts";
