/** One `import` statement an MDX document makes. */
interface Import {
    specifier: string;
    /** Local name to exported name; `default` names the default import. */
    bindings: Map<string, string>;
}

/**
 * An `import` statement, which may span lines: `import {\n    Badge,\n} from "x"`
 * is ordinary formatting. Non-greedy up to the first specifier string, so the
 * next statement in the same block is a separate match.
 */
const IMPORT_RE =
    /^[^\S\n]*import\b[\s\S]*?(?:from[^\S\n]*(?:"[^"\n]*"|'[^'\n]*')|(?:"[^"\n]*"|'[^'\n]*'))[^\S\n]*;?/gm;

/** Splits one statement into its clause and its specifier. */
const PARTS_RE = /^[^\S\n]*import\b([\s\S]*?)from[^\S\n]*("[^"\n]*"|'[^'\n]*')[^\S\n]*;?$/;
const SIDE_EFFECT_RE = /^[^\S\n]*import[^\S\n]*("[^"\n]*"|'[^'\n]*')[^\S\n]*;?$/;

/**
 * The imports in one top-level ESM block, and what is left after removing them.
 *
 * The remainder matters: a block holds whatever the author wrote, so an
 * `export const` can sit beside an import and the document's body may use it.
 * Dropping the whole block would take the export with the import, and `{year}`
 * would throw at runtime while the same file renders under a bundler.
 *
 * Anything import-shaped that this cannot read throws rather than being
 * skipped: a skipped import is a component that silently renders as nothing,
 * which is the failure this whole path exists to remove.
 */
export function readEsm(block: string, where: string) {
    let imports: Import[] = [];
    let remainder = block.replace(IMPORT_RE, statement => {
        let read = readImport(statement.trim(), where);
        if (read) imports.push(read);
        // Blanked rather than deleted, so every offset after it still lines up
        // with the source the author wrote.
        return blankLike(statement);
    });

    if (/^[^\S\n]*import\b/m.test(remainder)) throw unreadable(remainder.trim(), where);
    return { imports, remainder };
}

/** Keeps a removed statement's newlines, so later line numbers do not shift. */
function blankLike(statement: string) {
    return "\n".repeat((statement.match(/\n/g) ?? []).length);
}

/** Reads one statement, or nothing when it is type-only. */
function readImport(statement: string, where: string): Import | undefined {
    let sideEffect = SIDE_EFFECT_RE.exec(statement);
    if (sideEffect) return { specifier: unquote(sideEffect[1]!), bindings: new Map() };

    let matched = PARTS_RE.exec(statement);
    if (!matched) throw unreadable(statement, where);

    let clause = matched[1]!.trim();
    // A bundler erases `import type` before anything runs, and the module it
    // names may hold nothing but types. Importing it would be a new
    // requirement the bundled path does not have.
    if (/^type\b/.test(clause)) return undefined;

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
        if (entry.length === 0 || /^type\b/.test(entry)) continue;
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
