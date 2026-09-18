import type { LoadedEntry } from "./types.ts";

import { PREBUILT_MANIFEST_KEY } from "./symbols.ts";

/** The prefix of the virtual modules that carry each entry's raw body. */
export const BODY_PREFIX = "\0pitlane-content/entry/";

/**
 * The manifest module `content()` emits, as JavaScript source.
 *
 * Every value is a literal so the bundler can see it, and each body is a static
 * import of a virtual module, which is the step no runtime cleverness replaces:
 * a component is code, and only the bundler turns source into code.
 *
 * `bodies` is filled with the sources those virtual modules resolve to.
 */
export function manifestModule(
    collections: Record<string, LoadedEntry[]>,
    bodies: Map<string, string>,
): string {
    let imports: string[] = [];
    bodies.clear();

    let entries = Object.entries(collections).map(([collection, loaded]) => {
        let items = loaded.map(entry => {
            let where = `${collection}/${entry.id}`;
            let fields = [`id: ${literal(entry.id, where)}`, `data: ${literal(entry.data, where)}`];
            if (entry.filePath) fields.push(`filePath: ${literal(entry.filePath, where)}`);
            if (entry.body) {
                let binding = `body${bodies.size}`;
                let id = `${BODY_PREFIX}${collection}/${entry.id}.${entry.body.format}`;
                bodies.set(id, entry.body.source);
                imports.push(`import * as ${binding} from ${literal(id, where)};`);
                fields.push(`body: ${bodyExpression(entry.body.format, binding)}`);
            }
            return `{ ${fields.join(", ")} }`;
        });
        return `    ${literal(collection)}: [${items.join(", ")}]`;
    });

    return [
        ...imports,
        `globalThis[Symbol.for(${literal(PREBUILT_MANIFEST_KEY)})] = {`,
        entries.join(",\n"),
        "};",
        "",
    ].join("\n");
}

/**
 * MDX compiles to a module carrying a component and a heading list. Markdown
 * compiles to an HTML string, which `vite-plugin-satteri` exports as `html`.
 */
function bodyExpression(format: "md" | "mdx", binding: string) {
    if (format === "mdx") return `{ format: "mdx", module: ${binding} }`;
    return `{ format: "md", html: ${binding}.html ?? ${binding}.default }`;
}

/**
 * Writes a value as JavaScript source, preserving what JSON would flatten.
 *
 * Refuses anything it cannot write exactly. The alternative is worse than an
 * error: a `Map` would arrive as `{}` and a `NaN` as `null`, and the page built
 * from it would be wrong with nothing to read in the build log. `where` names
 * the entry in that message, because a build failure without one sends the
 * reader through every file in the collection.
 */
export function literal(value: unknown, where = "an entry", seen = new Set<object>()): string {
    if (value === undefined) return "undefined";
    if (value === null) return "null";

    if (typeof value === "string") return quote(value);
    if (typeof value === "boolean") return String(value);
    if (typeof value === "bigint") return `${value}n`;
    if (typeof value === "number") {
        if (!Number.isFinite(value)) throw unwritable(where, value);
        return Object.is(value, -0) ? "-0" : String(value);
    }

    if (typeof value !== "object") throw unwritable(where, value);
    if (seen.has(value)) {
        throw new Error(`${where} contains a cycle, which cannot be written into the manifest.`);
    }

    let nested = new Set(seen).add(value);
    if (value instanceof Date) return `new Date(${quote(value.toISOString())})`;
    if (Array.isArray(value)) {
        return `[${value.map(item => literal(item, where, nested)).join(", ")}]`;
    }

    // Anything with its own prototype carries behavior or private state that a
    // literal cannot reproduce, so `{ ...it }` would be a quiet lie.
    let prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype !== Object.prototype && prototype !== null) throw unwritable(where, value);

    let fields = Object.entries(value).map(
        ([key, field]) => `${quote(key)}: ${literal(field, where, nested)}`,
    );
    return `{ ${fields.join(", ")} }`;
}

/**
 * A quoted string, with the two separators `JSON.stringify` leaves raw.
 *
 * U+2028 and U+2029 are line terminators in JavaScript but not in JSON, so a
 * frontmatter value containing one would end the statement it sits in.
 */
function quote(text: string) {
    return JSON.stringify(text)
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

function unwritable(where: string, value: unknown) {
    return new Error(
        `${where} produced ${describe(value)}, which cannot be written into the manifest.`,
    );
}

function describe(value: unknown): string {
    if (typeof value === "number") return `the number ${String(value)}`;
    if (typeof value === "function") return "a function";
    if (typeof value === "symbol") return "a symbol";
    if (typeof value === "object" && value !== null) {
        return `a ${value.constructor?.name ?? "non-plain object"}`;
    }
    return `a ${typeof value}`;
}
