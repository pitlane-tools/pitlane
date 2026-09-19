import type {
    ChainableSchema,
    Reference,
    ReferenceSchema,
    RunContext,
    StandardSchemaResult,
} from "./types.ts";

/**
 * A schema that reads an entry id and outputs a pointer into `collection`.
 *
 * Built by hand rather than with `remix/data-schema`'s `createSchema`, so that
 * reading a JSON file into a validated collection needs no framework. The
 * shape is the one `s.object`, `s.array`, and `s.optional` require of anything
 * they hold, so a reference still composes inside them like any other schema.
 *
 * It does not check that the target exists: the collection it points at may
 * not be populated yet, and populating it to check would turn reading one
 * entry into loading every collection it references. A dangling pointer
 * surfaces as `getEntry` resolving to `undefined`.
 */
export function reference<C extends string>(collection: C): ReferenceSchema<C> {
    return chainable<string, Reference<C>>((value, context) => {
        if (typeof value !== "string") {
            let message = `Expected a reference id for collection "${collection}"`;
            return {
                issues: [context.path.length > 0 ? { message, path: context.path } : { message }],
            };
        }
        return { value: { collection, id: value } };
    });
}

/**
 * Wraps a validator in the chainable surface.
 *
 * `pipe` and `refine` return the schema unchanged. A reference validates a
 * fixed shape, so a check on top of it belongs on the combinator that consumes
 * the resolved entry; they exist because the type requires them and a caller
 * that chains one should get a schema back rather than `undefined`.
 */
function chainable<Input, Output>(
    run: (value: unknown, context: RunContext) => StandardSchemaResult<Output>,
): ChainableSchema<Input, Output> {
    let schema: ChainableSchema<Input, Output> = {
        "~standard": {
            version: 1,
            vendor: "pitlane-content",
            validate: value => run(value, { path: [] }),
        },
        "~run": run,
        pipe: () => schema,
        refine: () => schema,
        transform: transformer =>
            chainable((value, context) => {
                let result = run(value, context);
                if (result.issues) return result;
                return { value: transformer(result.value) };
            }),
    };

    return schema;
}
