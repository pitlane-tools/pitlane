/** One `import` statement an MDX document makes. */
interface Import {
    specifier: string;
    /** Local name to exported name; `default` names the default import. */
    bindings: Map<string, string>;
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
 * Read with a scanner rather than a pattern. A line beginning with `import`
 * inside a template literal is not an import, `//` inside a string is not a
 * comment, and a regex cannot tell the difference.
 *
 * Anything import-shaped that this cannot read throws rather than being
 * skipped: a skipped import is a component that silently renders as nothing,
 * which is the failure this whole path exists to remove.
 */
export function readEsm(block: string, where: string) {
    let { imports: spans, comments } = scan(block);
    let imports: Import[] = [];
    for (let span of spans) {
        let read = readImport(block.slice(span.start, span.end).trim(), where);
        if (read) imports.push(read);
    }

    return { imports, remainder: blank(block, [...spans, ...comments]) };
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

/**
 * Finds the `import` declarations and comments in a block of ESM source.
 *
 * The block is known-good ESM: MDX parsed it with a real parser to classify it
 * as one. So this only has to track which characters are code, which is enough
 * to tell a declaration from the word `import` inside a string, a template, a
 * comment, `import(...)`, or `import.meta`.
 */
function scan(block: string) {
    let imports: Span[] = [];
    let comments: Span[] = [];
    let index = 0;

    while (index < block.length) {
        let char = block[index]!;

        if (char === "/" && block[index + 1] === "/") {
            let end = block.indexOf("\n", index);
            comments.push({ start: index, end: end === -1 ? block.length : end });
            index = end === -1 ? block.length : end;
        } else if (char === "/" && block[index + 1] === "*") {
            let close = block.indexOf("*/", index + 2);
            let end = close === -1 ? block.length : close + 2;
            comments.push({ start: index, end });
            index = end;
        } else if (char === '"' || char === "'") {
            index = endOfString(block, index, char);
        } else if (char === "`") {
            index = endOfTemplate(block, index);
        } else if (isWordStart(char)) {
            let end = index;
            while (end < block.length && isWordPart(block[end]!)) end += 1;
            if (block.slice(index, end) === "import" && isDeclaration(block, end)) {
                let statement = endOfImport(block, end);
                imports.push({ start: index, end: statement });
                index = statement;
            } else {
                index = end;
            }
        } else {
            index += 1;
        }
    }

    return { imports, comments };
}

/** `import(` is a dynamic import and `import.meta` is a property access. */
function isDeclaration(block: string, after: number) {
    let next = block.slice(after).match(/^\s*(.?)/)?.[1] ?? "";
    return next !== "(" && next !== ".";
}

/**
 * The end of an import declaration, which is its module specifier plus an
 * optional semicolon. No other string can appear before the specifier, so the
 * first one that closes ends the statement.
 */
function endOfImport(block: string, after: number) {
    let index = after;
    while (index < block.length) {
        let char = block[index]!;
        if (char === '"' || char === "'") {
            let end = endOfString(block, index, char);
            let semicolon = /^[^\S\n]*;/.exec(block.slice(end));
            return semicolon ? end + semicolon[0].length : end;
        }
        if (char === "/" && block[index + 1] === "/") {
            let line = block.indexOf("\n", index);
            index = line === -1 ? block.length : line;
        } else if (char === "/" && block[index + 1] === "*") {
            let close = block.indexOf("*/", index + 2);
            index = close === -1 ? block.length : close + 2;
        } else {
            index += 1;
        }
    }
    return block.length;
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

/** Templates nest: `${}` holds code, which may hold another template. */
function endOfTemplate(block: string, start: number) {
    let index = start + 1;
    while (index < block.length) {
        let char = block[index]!;
        if (char === "\\") index += 2;
        else if (char === "`") return index + 1;
        else if (char === "$" && block[index + 1] === "{")
            index = endOfInterpolation(block, index + 2);
        else index += 1;
    }
    return block.length;
}

function endOfInterpolation(block: string, start: number) {
    let index = start;
    let depth = 1;
    while (index < block.length && depth > 0) {
        let char = block[index]!;
        if (char === '"' || char === "'") index = endOfString(block, index, char);
        else if (char === "`") index = endOfTemplate(block, index);
        else {
            if (char === "{") depth += 1;
            else if (char === "}") depth -= 1;
            index += 1;
        }
    }
    return index;
}

function isWordStart(char: string) {
    return /[A-Za-z_$]/.test(char);
}

function isWordPart(char: string) {
    return /[\w$]/.test(char);
}

const PARTS_RE = /^import\b([\s\S]*?)from[^\S\n]*("[^"]*"|'[^']*')[^\S\n]*;?$/;
const SIDE_EFFECT_RE = /^import[^\S\n]*("[^"]*"|'[^']*')[^\S\n]*;?$/;

/** Reads one statement, or nothing when it is type-only. */
function readImport(statement: string, where: string): Import | undefined {
    let sideEffect = SIDE_EFFECT_RE.exec(statement);
    if (sideEffect) return { specifier: unquote(sideEffect[1]!), bindings: new Map() };

    let matched = PARTS_RE.exec(statement);
    if (!matched) throw unreadable(statement, where);

    let clause = matched[1]!.trim();
    // `import type X from` and `import type { X } from` are erased by a bundler
    // before anything runs, and the module they name may hold nothing but
    // types. `import type from` is different: that is a default import whose
    // local name happens to be `type`.
    if (/^type\s+\S/.test(clause)) return undefined;

    return {
        specifier: unquote(matched[2]!),
        bindings: readBindings(clause, statement, where),
    };
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

/**
 * A local name becomes a parameter of the function the compiled body is
 * evaluated as, so anything that is not an identifier has to be refused here
 * rather than producing a syntax error in generated source.
 */
function identifier(name: string, statement: string, where: string) {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw unreadable(statement, where);
    return name;
}

function unquote(quoted: string) {
    return quoted.slice(1, -1);
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
