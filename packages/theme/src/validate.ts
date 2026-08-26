import type { Schema } from "remix/data-schema";

import { createSchema, fail, object } from "remix/data-schema";

import type { SchemaNode, TokenSchema } from "./schema.ts";
import type { Tokens } from "./types.ts";

import { childSchema, pathKey, selfSchema } from "./schema.ts";

/**
 * Composes the sparse schema tree and the token tree into one
 * `remix/data-schema` object schema, so a single `parse` validates
 * every token and reports each failure with its own path.
 *
 * A token with no schema entry gets a schema that always fails, so a
 * missing declaration is reported alongside any bad values rather than
 * short-circuiting them.
 *
 * @internal
 */
export function composeSchema(
    tokens: Tokens,
    schema: Record<string, SchemaNode>,
): Schema<unknown, unknown> {
    return compose(tokens, schema, undefined);
}

function compose(
    tokens: Tokens,
    schema: unknown,
    inherited: TokenSchema | undefined,
): Schema<unknown, unknown> {
    let shape: Record<string, Schema<unknown, unknown>> = {};
    for (let [key, value] of Object.entries(tokens)) {
        let child = childSchema(schema, key);
        let own = selfSchema(child) ?? inherited;

        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            shape[key] = compose(value as Tokens, child, own);
        } else if (own === undefined) {
            shape[key] = createSchema((_, context) =>
                fail(`"${pathKey(context.path)}" has no schema entry`, context.path),
            );
        } else {
            shape[key] = own;
        }
    }
    return object(shape);
}
