/** One `import` statement an MDX document makes. */
interface Import {
    specifier: string;
    /** Local name to exported name; `default` and `*` name those two forms. */
    bindings: Map<string, string>;
}

const IMPORT_RE = /^[^\S\n]*import\b([\s\S]*?)from\s*("[^"]*"|'[^']*')[^\S\n]*;?[^\S\n]*$/;
const SIDE_EFFECT_RE = /^[^\S\n]*import\s*("[^"]*"|'[^']*')[^\S\n]*;?[^\S\n]*$/;

/**
 * The imports in an MDX document's top-level ESM blocks.
 *
 * `statements` are the `mdxjsEsm` node values Sätteri parsed, so this only has
 * to read statements MDX already accepted — not find them. Anything
 * import-shaped that this cannot read throws rather than being skipped: a
 * skipped import is a component that silently renders as nothing, which is the
 * failure this whole path exists to remove.
 */
export function readImports(statements: readonly string[], where: string): Import[] {
    let imports: Import[] = [];
    for (let statement of statements) {
        for (let line of splitStatements(statement)) {
            if (!/^\s*import\b/.test(line)) continue;
            imports.push(readImport(line, where));
        }
    }
    return imports;
}

/** Splits an ESM block into statements, so one node can carry several imports. */
function splitStatements(block: string) {
    return block
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

function readImport(line: string, where: string): Import {
    let sideEffect = SIDE_EFFECT_RE.exec(line);
    if (sideEffect) return { specifier: unquote(sideEffect[1]!), bindings: new Map() };

    let matched = IMPORT_RE.exec(line);
    if (!matched) throw unreadable(line, where);

    return {
        specifier: unquote(matched[2]!),
        bindings: readBindings(matched[1]!.trim(), line, where),
    };
}

function readBindings(clause: string, line: string, where: string) {
    let bindings = new Map<string, string>();
    let named = /\{([\s\S]*)\}/.exec(clause);
    let head = (named ? clause.slice(0, named.index) : clause).replace(/,\s*$/, "").trim();

    if (head.startsWith("* as ")) {
        bindings.set(head.slice(5).trim(), "*");
    } else if (head.length > 0) {
        bindings.set(head, "default");
    }

    for (let part of named?.[1]?.split(",") ?? []) {
        let entry = part.trim();
        if (entry.length === 0) continue;
        let renamed = /^(\S+)\s+as\s+(\S+)$/.exec(entry);
        if (renamed) bindings.set(renamed[2]!, renamed[1]!);
        else if (/^[A-Za-z_$][\w$]*$/.test(entry)) bindings.set(entry, entry);
        else throw unreadable(line, where);
    }

    return bindings;
}

function unquote(quoted: string) {
    return quoted.slice(1, -1);
}

function unreadable(line: string, where: string) {
    return new Error(
        `Could not read the import \`${line}\` in "${where}". Rendering an MDX entry outside a ` +
            "bundler resolves its imports directly, which needs an ordinary import statement.",
    );
}
