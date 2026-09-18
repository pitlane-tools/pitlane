/** One `import` statement an MDX document makes. */
interface Import {
    specifier: string;
    /** Local name to exported name; `default` names the default import. */
    bindings: Map<string, string>;
    /** A `with { ... }` clause, for a module that needs one to load. */
    attributes?: Record<string, string>;
}

/** A half-open range of the block being read. */
interface Span {
    start: number;
    end: number;
}

/**
 * The imports in one top-level ESM block, and what is left after removing them.
 *
 * The remainder matters twice over. A block holds whatever the author wrote, so
 * an `export const` can sit beside an import and the document's body may use
 * it; dropping the whole block would take the export with the import. And what
 * is left is spliced back into the document, so it has to stay recognisable as
 * ESM: a comment surviving on its own line starts a paragraph, which swallows
 * the export that follows it.
 *
 * Statement boundaries come from `es-module-lexer`, the lexer Vite reads the
 * same imports with. Deciding them here instead means reimplementing JavaScript
 * tokenization: a quote inside a regex literal is not a string, a line starting
 * with `import` inside a template is not a statement, `{ import: "x" }` is a
 * property, and each of those was wrong before the lexer answered it.
 *
 * Anything import-shaped the lexer reports and this cannot read throws rather
 * than being skipped: a skipped import is a component that silently renders as
 * nothing, which is the failure this whole path exists to remove.
 */
export async function readEsm(block: string, where: string) {
    let { init, parse } = await import("es-module-lexer");
    await init;

    let comments = commentSpans(block);
    let statements: Span[] = [];
    let imports: Import[] = [];

    for (let found of parse(block)[0]) {
        if (found.t === 3) throw importMeta(where);
        // A re-export has a specifier too, and it is an export: it stays.
        if (found.t !== 1 || !block.startsWith("import", found.ss)) continue;

        statements.push({ start: found.ss, end: endOfStatement(block, found.se) });
        let read = readImport(block, found, comments, where);
        if (read) imports.push(read);
    }

    let outside = comments.filter(comment => !statements.some(held => covers(held, comment)));
    return { imports, remainder: blank(block, [...statements, ...outside]) };
}

function covers(outer: Span, inner: Span) {
    return inner.start >= outer.start && inner.end <= outer.end;
}

/**
 * The lexer's statement end stops at the specifier or its attributes, so the
 * trailing semicolon is left behind. On its own line in the remainder it is a
 * paragraph reading `;`.
 */
function endOfStatement(block: string, end: number) {
    let semicolon = /^[^\S\n]*;/.exec(block.slice(end));
    return semicolon ? end + semicolon[0].length : end;
}

/**
 * Replaces each span with its own newlines.
 *
 * Blanked rather than deleted so every offset after it still lines up with the
 * source the author wrote, which is what keeps a later error's line number
 * pointing at the right line.
 */
function blank(block: string, spans: readonly Span[]) {
    let ordered = [...spans].sort((a, b) => b.start - a.start);
    let out = block;
    for (let { start, end } of ordered) {
        let removed = out.slice(start, end);
        out =
            out.slice(0, start) + "\n".repeat((removed.match(/\n/g) ?? []).length) + out.slice(end);
    }
    return out;
}

/** One import statement, as the lexer reports it. */
interface Found {
    /** Start and end of the module specifier, inside its quotes. */
    s: number;
    e: number;
    /** Start and end of the statement; the end is past any attributes clause. */
    ss: number;
    se: number;
    /** Start of the `with { ... }` clause, or -1. */
    a: number;
    /** The specifier with its escape sequences decoded. */
    n: string | undefined;
}

/** Reads one statement, or nothing when it is type-only. */
function readImport(
    block: string,
    found: Found,
    comments: readonly Span[],
    where: string,
): Import | undefined {
    let statement = block.slice(found.ss, found.e + 1);
    let specifier = found.n;
    if (specifier === undefined) throw unreadable(statement, where);

    // Between `import` and the specifier's opening quote, with any comment
    // inside it spaced out: `import /* the badge */ { Badge } from "./x"` is
    // one statement to every bundler, and its clause is `{ Badge }`.
    let clause = erase(block, { start: found.ss + "import".length, end: found.s - 1 }, comments)
        .trim()
        .replace(/\bfrom$/, "")
        .trim();

    // `import type X from` and `import type { X } from` are erased by a bundler
    // before anything runs, and the module they name may hold nothing but
    // types. `import type from` is different: that is a default import whose
    // local name happens to be `type`.
    if (/^type\s+\S/.test(clause)) return undefined;

    let attributes = found.a === -1 ? undefined : readAttributes(block.slice(found.a, found.se));
    return { specifier, bindings: readBindings(clause, statement, where), attributes };
}

/** A slice of the block with any comment in it replaced by blanks. */
function erase(block: string, span: Span, comments: readonly Span[]) {
    let out = block.slice(span.start, span.end);
    for (let comment of comments) {
        if (!covers(span, comment)) continue;
        let start = comment.start - span.start;
        let width = comment.end - comment.start;
        out = out.slice(0, start) + " ".repeat(width) + out.slice(start + width);
    }
    return out;
}

function readBindings(clause: string, statement: string, where: string) {
    let bindings = new Map<string, string>();
    let named = /\{([\s\S]*)\}/.exec(clause);
    let head = (named ? clause.slice(0, named.index) : clause).replace(/,\s*$/, "").trim();

    if (head.startsWith("* as ")) throw namespaceImport(head.slice(5).trim(), statement, where);
    if (head.length > 0) bindings.set(identifier(head, statement, where), "default");

    for (let part of named?.[1]?.split(",") ?? []) {
        let entry = part.trim();
        if (entry.length === 0) continue;

        // `{ type X }` and `{ type X as Y }` are type specifiers. `{ type }`
        // and `{ type as t }` import an export whose name is `type`, which is
        // what `arktype` publishes.
        let words = entry.split(/\s+/);
        if (words[0] === "type" && words.length > 1 && words[1] !== "as") continue;

        let renamed = /^(\S+)\s+as\s+(\S+)$/.exec(entry);
        if (renamed) bindings.set(identifier(renamed[2]!, statement, where), renamed[1]!);
        else bindings.set(identifier(entry, statement, where), entry);
    }

    return bindings;
}

const ATTRIBUTE_RE = /(?:([A-Za-z_$][\w$]*)|"([^"]*)"|'([^']*)')\s*:\s*(?:"([^"]*)"|'([^']*)')/g;

/**
 * An attributes clause has to reach the `import()` this path performs. Dropping
 * it leaves `import data from "./x.json" with { type: "json" }` importing the
 * file with no attribute, which Node refuses outright.
 */
function readAttributes(clause: string) {
    let attributes: Record<string, string> = {};
    for (let [, name, quoted, single, value, singleValue] of clause.matchAll(ATTRIBUTE_RE)) {
        attributes[(name ?? quoted ?? single)!] = (value ?? singleValue)!;
    }
    return attributes;
}

/**
 * The comments in a block of ESM source.
 *
 * Only comments: the lexer answers for imports, so a mistake here leaves a
 * comment in the remainder rather than losing a component. Regex literals are
 * tracked all the same, because `/"/` holds a quote that would otherwise open a
 * string running to the end of the next real one.
 */
function commentSpans(block: string) {
    let comments: Span[] = [];
    let nesting: ("template" | "interpolation" | "brace")[] = [];
    let previous = "";
    let index = 0;

    while (index < block.length) {
        let char = block[index]!;

        if (nesting.at(-1) === "template") {
            if (char === "\\") {
                index += 2;
            } else if (char === "`") {
                nesting.pop();
                previous = "`";
                index += 1;
            } else if (char === "$" && block[index + 1] === "{") {
                nesting.push("interpolation");
                previous = "";
                index += 2;
            } else {
                index += 1;
            }
            continue;
        }

        if (char === "/" && block[index + 1] === "/") {
            let line = block.indexOf("\n", index);
            let end = line === -1 ? block.length : line;
            comments.push({ start: index, end });
            index = end;
        } else if (char === "/" && block[index + 1] === "*") {
            let close = block.indexOf("*/", index + 2);
            let end = close === -1 ? block.length : close + 2;
            comments.push({ start: index, end });
            index = end;
        } else if (char === "/" && startsRegex(previous)) {
            index = endOfRegex(block, index);
            previous = "/";
        } else if (char === '"' || char === "'") {
            index = endOfString(block, index, char);
            previous = char;
        } else if (char === "`") {
            nesting.push("template");
            index += 1;
        } else if (char === "{") {
            nesting.push("brace");
            previous = char;
            index += 1;
        } else if (char === "}") {
            if (nesting.length > 0) nesting.pop();
            previous = char;
            index += 1;
        } else if (isWordStart(char)) {
            let end = index;
            while (end < block.length && isWordPart(block[end]!)) end += 1;
            previous = block.slice(index, end);
            index = end;
        } else if (/\s/.test(char)) {
            index += 1;
        } else {
            previous = char;
            index += 1;
        }
    }

    return comments;
}

/** Where a `/` can only begin a regex, never divide. */
const BEFORE_REGEX = new Set([
    "",
    "=",
    "(",
    ",",
    ":",
    "[",
    "!",
    "&",
    "|",
    "?",
    ";",
    "{",
    "}",
    "+",
    "-",
    "*",
    "%",
    "~",
    "^",
    "<",
    ">",
    "return",
    "typeof",
    "instanceof",
    "in",
    "of",
    "new",
    "delete",
    "void",
    "case",
    "do",
    "else",
    "yield",
    "await",
    "throw",
]);

function startsRegex(previous: string) {
    return BEFORE_REGEX.has(previous);
}

/**
 * The end of a regex literal, or the `/` itself when it turns out to divide.
 *
 * A literal never spans a line, so an unclosed one by the end of the line is
 * division after all, whatever the token before it suggested.
 */
function endOfRegex(block: string, start: number) {
    let index = start + 1;
    let inClass = false;

    while (index < block.length) {
        let char = block[index]!;
        if (char === "\n") return start + 1;
        if (char === "\\") {
            index += 2;
        } else if (char === "[") {
            inClass = true;
            index += 1;
        } else if (char === "]") {
            inClass = false;
            index += 1;
        } else if (char === "/" && !inClass) {
            index += 1;
            while (index < block.length && /[a-z]/.test(block[index]!)) index += 1;
            return index;
        } else {
            index += 1;
        }
    }

    return start + 1;
}

function endOfString(block: string, start: number, quote: string) {
    let index = start + 1;
    while (index < block.length) {
        let char = block[index]!;
        if (char === "\\") index += 2;
        else if (char === quote) return index + 1;
        else index += 1;
    }
    return block.length;
}

function isWordStart(char: string) {
    return /[A-Za-z_$]/.test(char);
}

function isWordPart(char: string) {
    return /[\w$]/.test(char);
}

/**
 * A bundler compiles the document to a module, where `import.meta` is
 * ordinary. Here the body is a function body, so the engine refuses it with
 * `SyntaxError: Cannot use 'import.meta' outside a module` thrown from source
 * the author never wrote, naming neither the document nor the reason.
 */
function importMeta(where: string) {
    return new Error(
        `"${where}" uses \`import.meta\`, which cannot be evaluated outside a bundler: the ` +
            `document is compiled to a function body rather than a module. Add content() from ` +
            `@pitlane/content/vite so the build compiles this collection.`,
    );
}

/**
 * A local name becomes a parameter of the function the compiled body is
 * evaluated as, so anything that is not an identifier has to be refused here
 * rather than producing a syntax error in generated source.
 */
function identifier(name: string, statement: string, where: string) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw unreadable(statement, where);
    return name;
}

/**
 * Sätteri compiles `import * as ui from "./x.tsx"` to `const {} = arguments[0]`
 * in `function-body` mode: the local name is never bound, so the document
 * throws `ReferenceError: ui is not defined` from inside compiled source the
 * author never wrote. Refused here, where the file and the statement are both
 * still in hand. A bundler compiles the same document to a module, where the
 * namespace import is ordinary and works.
 */
function namespaceImport(local: string, statement: string, where: string) {
    return new Error(
        `"${where}" imports \`* as ${local}\` in \`${statement}\`, which cannot be resolved ` +
            `outside a bundler. Import the components by name instead, or add content() from ` +
            `@pitlane/content/vite so the build compiles this collection.`,
    );
}

function unreadable(statement: string, where: string) {
    return new Error(
        `Could not read the import \`${statement}\` in "${where}". Rendering an MDX entry ` +
            "outside a bundler resolves its imports directly, which needs an ordinary import " +
            "statement.",
    );
}
