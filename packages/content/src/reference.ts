import { createSchema, fail } from "remix/data-schema";

import type { Reference, ReferenceSchema } from "./types.ts";

/**
 * A schema that reads an entry id and outputs a pointer into `collection`.
 *
 * Built with `createSchema`, so it is an ordinary Standard Schema and composes
 * inside `s.object`, `s.array`, and `s.optional` like any other. It does not
 * check that the target exists: the collection it points at may not be
 * populated yet, and populating it to check would turn reading one entry into
 * loading every collection it references. A dangling pointer surfaces as
 * `getEntry` resolving to `undefined`.
 */
export function reference<C extends string>(collection: C): ReferenceSchema<C> {
    return createSchema<string, Reference<C>>((value, context) => {
        if (typeof value !== "string") {
            return fail(`Expected a reference id for collection "${collection}"`, context.path);
        }
        return { value: { collection, id: value } };
    });
}
