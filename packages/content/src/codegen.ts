import type { LoadedEntry } from "./types.ts";

import { PREBUILT_MANIFEST_KEY } from "./symbols.ts";

/** The prefix of the virtual modules that carry each entry's raw body. */
export const BODY_PREFIX = "\0pitlane-content/entry/";

/** One entry's raw body, and the file it was read from. */
export interface Body {
    source: string;
    format: "md" | "mdx";
    /** Absent for a loader that produced the body without a file. */
    filePath?: string;
}

/**
 * The manifest module `contentLayer()` emits, as JavaScript source.
 *
 * Every value is a literal so the bundler can see it, and each body is a static
 * import of a virtual module, which is the step no runtime cleverness replaces:
 * a component is code, and only the bundler turns source into code.
 *
 * `bodies` is filled with the sources those virtual modules resolve to, each
 * with the path of the entry it came from. A body module has no directory of
 * its own, so a relative import inside it can only be resolved against that.
 *
 * `headings` holds the list the build measured for each Markdown entry, keyed
 * the way `bodies` is. Markdown compiles to an HTML string, which carries no
 * heading list, so without this a prebuilt page's table of contents is empty
 * while the same file renders one at runtime.
 */
export function manifestModule(
    collections: Record<string, LoadedEntry[]>,
    bodies: Map<string, Body>,
    headings: ReadonlyMap<string, unknown> = new Map(),
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
                bodies.set(id, {
                    source: entry.body.source,
                    format: entry.body.format,
                    filePath: entry.filePath,
                });
                imports.push(`import * as ${binding} from ${literal(id, where)};`);
                fields.push(
                    `body: ${bodyExpression(entry.body.format, binding, headings.get(id), where)}`,
                );
            }
            return `{ ${fields.join(", ")} }`;
        });
        // Computed, because a quoted `"__proto__"` key in an object literal is
        // still the prototype setter. A collection may be named anything.
        return `    [${literal(collection)}]: [${items.join(", ")}]`;
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
 * compiles to an HTML string, which `vite-plugin-satteri` exports as `html`,
 * so its heading list is written beside it.
 */
function bodyExpression(format: "md" | "mdx", binding: string, headings: unknown, where: string) {
    if (format === "mdx") return `{ format: "mdx", module: ${binding} }`;
    let measured = headings === undefined ? "" : `, headings: ${literal(headings, where)}`;
    return `{ format: "md", html: ${binding}.html ?? ${binding}.default${measured} }`;
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
    if (value instanceof Date) {
        // An invalid Date would make `toISOString` throw a bare `RangeError`,
        // which names neither the entry nor the manifest.
        if (Number.isNaN(value.getTime())) throw unwritable(where, value);
        return `new Date(${quote(value.toISOString())})`;
    }

    // Anything with a prototype other than `Object.prototype` carries behavior
    // or private state a literal cannot reproduce, so `{ ...it }` would be a
    // quiet lie. A null prototype is refused for the same reason in reverse:
    // an object literal always has `Object.prototype`, so re-emitting a bare
    // object would hand the runtime something the build never had.
    if (
        Object.getPrototypeOf(value) !== (Array.isArray(value) ? Array.prototype : Object.prototype)
    ) {
        throw unwritable(where, value);
    }

    let keys = Reflect.ownKeys(value);
    if (Array.isArray(value)) {
        // Indices plus `length`; anything else is an own property the array
        // branch below would drop.
        let extra = keys.filter(key => key !== "length" && !isIndex(key, value.length));
        if (extra.length > 0) throw unwritableKey(where, extra[0]!);
        return `[${value.map(item => literal(item, where, nested)).join(", ")}]`;
    }

    let fields = keys.map(key => {
        // `Reflect.ownKeys` sees what `Object.entries` hides: a symbol key and
        // a non-enumerable one have no literal spelling, and dropping either
        // silently is the failure this function exists to prevent.
        if (typeof key === "symbol") throw unwritableKey(where, key);
        let descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor?.enumerable || !("value" in descriptor)) throw unwritableKey(where, key);
        // `{ "__proto__": … }` sets the prototype rather than defining a
        // property, so writing this key verbatim is the one case where the two
        // hosts genuinely disagree about an entry's data.
        if (key === "__proto__") throw unwritableKey(where, key);
        return `${quote(key)}: ${literal(descriptor.value, where, nested)}`;
    });
    return `{ ${fields.join(", ")} }`;
}

function isIndex(key: string | symbol, length: number) {
    if (typeof key === "symbol") return false;
    let index = Number(key);
    return Number.isInteger(index) && index >= 0 && index < length;
}

function unwritableKey(where: string, key: string | symbol) {
    let name = typeof key === "symbol" ? key.toString() : `"${key}"`;
    return new Error(`${where} has a key ${name} that cannot be written into the manifest.`);
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
