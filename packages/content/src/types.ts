import type { Handle, RemixNode } from "remix/component";

/**
 * Standard Schema v1, declared here rather than depended on.
 *
 * The specification is frozen at version 1 and the interface is the whole of
 * it, so a dependency would buy nothing this comment does not. Any conforming
 * schema — `remix/data-schema`, Zod, Valibot, ArkType — satisfies it
 * structurally.
 *
 * @see https://standardschema.dev
 */
export interface StandardSchemaV1<Output = unknown> {
    readonly "~standard": {
        readonly version: 1;
        readonly vendor: string;
        readonly validate: (
            value: unknown,
        ) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
        readonly types?: { readonly output: Output } | undefined;
    };
}

/** The result of validating a value against a {@link StandardSchemaV1}. */
export type StandardSchemaResult<Output> =
    | { readonly value: Output; readonly issues?: undefined }
    | { readonly issues: readonly StandardSchemaIssue[] };

/** One validation failure, with the path into the input that produced it. */
export interface StandardSchemaIssue {
    readonly message: string;
    readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined;
}

/** The output type a schema produces. */
export type InferSchema<S> = S extends StandardSchemaV1<infer Output> ? Output : never;

/**
 * A resolved pointer from one entry to another, produced by
 * `c.reference(collection)`.
 *
 * The `collection` type parameter is what stops a `Reference<"blog">` reaching
 * `content.authors.getEntry`.
 */
export interface Reference<C extends string> {
    collection: C;
    id: string;
}

/** A reusable check, shaped as `remix/data-schema`'s `Check` is. */
export interface SchemaCheck<Output> {
    check: (value: Output) => boolean;
    message?: string;
    code?: string;
    values?: Record<string, unknown>;
}

/** Where a value sits in the input being validated, and how it is being parsed. */
export interface RunContext {
    path: NonNullable<StandardSchemaIssue["path"]>;
    options?: unknown;
}

/**
 * The surface `remix/data-schema`'s combinators require of a schema they hold.
 *
 * `s.object`, `s.array`, and `s.optional` call `~run` rather than the Standard
 * Schema `validate`, so a bare Standard Schema does not compose inside them and
 * a reference that does not compose is not worth having. Declared here rather
 * than imported: one type import would make Remix a requirement of reading a
 * JSON file. Any schema satisfying it is accepted, whoever built it.
 */
export interface ChainableSchema<Input, Output> {
    // Narrower than {@link StandardSchemaV1} in two ways the combinators
    // require: `validate` resolves synchronously, and `types` carries the
    // input as well as the output. It satisfies `StandardSchemaV1<Output>`
    // structurally, so a reference is still an ordinary Standard Schema
    // wherever one is accepted.
    readonly "~standard": {
        readonly version: 1;
        readonly vendor: string;
        readonly validate: (value: unknown) => StandardSchemaResult<Output>;
        readonly types?: { readonly input: Input; readonly output: Output } | undefined;
    };
    "~run": (value: unknown, context: RunContext) => StandardSchemaResult<Output>;
    pipe: (...checks: SchemaCheck<Output>[]) => ChainableSchema<Input, Output>;
    refine: (
        predicate: (value: Output) => boolean,
        message?: string,
    ) => ChainableSchema<Input, Output>;
    transform: <Next>(transformer: (value: Output) => Next) => ChainableSchema<Input, Next>;
}

/**
 * The schema `c.reference(collection)` returns: a Standard Schema that reads
 * an entry id (a string) and outputs a {@link Reference} into `collection`.
 *
 * It composes inside `remix/data-schema`'s `s.object`, `s.array`, and
 * `s.optional` like any other schema. It does not check that the target entry
 * exists; a dangling id surfaces as `getEntry` resolving to `undefined`.
 */
export type ReferenceSchema<C extends string> = ChainableSchema<string, Reference<C>>;

/** A heading collected from a Markdown or MDX document. */
export interface Heading {
    depth: number;
    slug: string;
    text: string;
}

/** What `entry.render()` resolves to. */
export interface RenderedEntry {
    /** The entry's rendered document as a Remix component, to render as `<Content />`. */
    Content: (handle: Handle<Record<string, unknown>>) => () => RemixNode;
    headings: Heading[];
}

/** One entry of a collection, as a caller sees it. */
export interface Entry<Data> {
    id: string;
    collection: string;
    data: Data;
    filePath?: string;
    /**
     * Renders the entry's Markdown or MDX body, from the build's compiled
     * output when `contentLayer()` prebuilt it and from source otherwise.
     * Rejects for an entry its loader gave no body.
     */
    render(): Promise<RenderedEntry>;
}

/**
 * One entry of `collection`, named the way an application thinks of it:
 * `CollectionEntry<typeof content.blog>`.
 *
 * {@link Entry} is keyed by the shape of the data, which is what the query
 * methods resolve to and all this package needs internally. An application
 * has the collection rather than the shape, and pulling one out of the other
 * is a conditional type every consumer would otherwise write for itself.
 */
export type CollectionEntry<C> = C extends Collection<string, infer Data> ? Entry<Data> : never;

/** The query surface of one collection. */
export interface Collection<Name extends string, Data> {
    /**
     * Every entry, sorted by id, keeping only those `filter` returns truthy
     * for when one is given.
     */
    getCollection(filter?: (entry: Entry<Data>) => unknown): Promise<Entry<Data>[]>;
    /**
     * The entry with this id, or the one a {@link Reference} into this
     * collection points at. Resolves to `undefined` when there is none.
     */
    getEntry(id: string | Reference<Name>): Promise<Entry<Data> | undefined>;
}

/** The raw source of an entry's document, before anything renders it. */
export interface EntryBody {
    format: "md" | "mdx";
    source: string;
}

/** What a {@link ContentLoader} writes into the store for one entry. */
export interface LoadedEntry {
    id: string;
    data: unknown;
    filePath?: string;
    body?: EntryBody;
}

/** What a {@link LiveLoader} returns for one entry. */
export interface LiveEntry<Data = Record<string, unknown>> {
    id: string;
    data: Data;
    body?: EntryBody;
}

/** What a loader is handed to read its source and validate what it found. */
export interface LoaderContext {
    collection: string;
    /**
     * The project root a relative path resolves against.
     *
     * `process.cwd()` at runtime, and the Vite root under `contentLayer()`, which is
     * what keeps a collection pointing at the same files when the build runs
     * from somewhere else.
     */
    root: string;
    /**
     * Validates one entry's data against the collection's schema and resolves
     * to the parsed value; rejects naming the entry when it does not conform.
     * Pass its result to `store.set`, never the raw data.
     */
    parseData<D>(input: { id: string; data: unknown; filePath?: string }): Promise<D>;
    store: {
        /** Adds one entry to the collection. An id written twice throws rather than merging. */
        set(entry: LoadedEntry): void;
    };
}

/**
 * A loader that resolves a whole collection by filling a store.
 *
 * Its shape is the claim that one execution produces the complete answer, which
 * is what lets `contentLayer()` run it during the build and inline the result.
 */
export interface ContentLoader {
    name: string;
    /**
     * Reads the whole source and writes every entry through `context.store.set`.
     * Runs on the collection's first read, or at build time under `contentLayer()`,
     * and the result is kept for every read after it.
     */
    load(context: LoaderContext): Promise<void> | void;
    /**
     * The files or directories the last `load` read, for a development host to
     * watch. Omit it, or return nothing, for a source with no local files.
     */
    watchedPaths?(): string[];
}

/**
 * A loader that answers one query at a time.
 *
 * There is no store to fill and so nothing to serialize: the only way to get
 * entries out of it is to ask, which means asking on every read.
 */
export interface LiveLoader<Data = Record<string, unknown>> {
    name: string;
    /** Every entry the source holds, unvalidated; called on every `getCollection`. */
    loadCollection(): Promise<LiveEntry<Data>[]>;
    /** The entry with this id, or `undefined` when the source has none; called on every `getEntry`. */
    loadEntry(id: string): Promise<LiveEntry<Data> | undefined>;
}

/**
 * Either kind of loader.
 *
 * A `LiveLoader`'s own `Data` parameter is for whoever writes it; a collection
 * accepts any of them, because what a loader hands back is unvalidated until
 * `parseData` has seen it.
 */
export type Loader = ContentLoader | LiveLoader<unknown>;

/** What `c.collection({ loader, schema })` returns. */
export interface CollectionDefinition<S extends StandardSchemaV1 = StandardSchemaV1> {
    loader: Loader;
    schema: S;
}

/** The builder `createContent` hands to its callback. */
export interface ContentBuilder {
    /** Declares one collection: where its entries come from and the schema each must satisfy. */
    collection<S extends StandardSchemaV1>(input: {
        loader: Loader;
        schema: S;
    }): CollectionDefinition<S>;
    /**
     * A schema for a field holding the id of an entry in `collection`, which
     * parses to a {@link Reference} that collection's `getEntry` accepts.
     */
    reference<C extends string>(collection: C): ReferenceSchema<C>;
}

/**
 * The object `createContent` returns: one {@link Collection} per key of the
 * definitions its callback returned, named after that key and typed by the
 * output of that collection's schema.
 */
export type Content<T extends Record<string, CollectionDefinition>> = {
    [K in keyof T]: Collection<K & string, InferSchema<T[K]["schema"]>>;
};

/** How `contentLayer()` spells an entry's body in the manifest it emits. */
export type PrebuiltBody =
    // Markdown compiles to HTML, which carries no heading list of its own, so
    // the build writes the one it measured alongside it. Without that a
    // prebuilt page's table of contents is empty while the same file renders
    // one at runtime.
    | { format: "md"; html: string; headings?: unknown }
    | { format: "mdx"; module: Record<string, unknown> };

/** One entry in the manifest `contentLayer()` emits. */
export interface PrebuiltEntry {
    id: string;
    data: unknown;
    filePath?: string;
    body?: PrebuiltBody;
}

/**
 * The manifest `contentLayer()` emits, keyed by collection name.
 *
 * A collection missing from it was not prebuilt, and its absence is what tells
 * the runtime to use the loader.
 */
export type PrebuiltCollections = Record<string, PrebuiltEntry[]>;

/** Options handed to a `loaders.glob` `generateId` function. */
export interface GenerateIdOptions {
    /** The matched path, relative to `base`. */
    entry: string;
    /** The directory the pattern resolved against. */
    base: string;
    /** The parsed data of the entry, for an id derived from frontmatter. */
    data: Record<string, unknown>;
}
