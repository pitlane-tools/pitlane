export interface ModuleSpecifier {
    specifier: string;
    line: number;
}

interface Token {
    kind: "word" | "string" | "punctuation";
    text: string;
    line: number;
}

/**
 * The modules a declaration file names in `import`, `export … from`, and
 * `import("…")`. Tokenizing, rather than matching the raw text, keeps
 * specifiers in TSDoc examples and string literal types from counting.
 */
export function moduleSpecifiers(declarations: string): ModuleSpecifier[] {
    let tokens = tokenize(declarations);
    let found: ModuleSpecifier[] = [];
    for (let [index, token] of tokens.entries()) {
        if (token.kind !== "word" || (token.text !== "from" && token.text !== "import")) continue;
        if (tokens[index - 1]?.text === ".") continue;
        let next = tokens[index + 1];
        if (token.text === "import" && next?.text === "(") next = tokens[index + 2];
        if (next?.kind === "string") found.push({ specifier: next.text, line: next.line });
    }
    return found;
}

const WORD = /[\w$]+/y;

function tokenize(source: string): Token[] {
    let tokens: Token[] = [];
    let line = 1;
    let index = 0;
    while (index < source.length) {
        let char = source[index];
        let rest = source.slice(index, index + 2);
        let end: number;
        if (rest === "//") {
            end = source.indexOf("\n", index);
            end = end === -1 ? source.length : end;
        } else if (rest === "/*") {
            end = source.indexOf("*/", index + 2);
            end = end === -1 ? source.length : end + 2;
        } else if (char === '"' || char === "'" || char === "`") {
            end = closingQuote(source, index);
            tokens.push({ kind: "string", text: source.slice(index + 1, end - 1), line });
        } else if (/[\w$]/.test(char)) {
            WORD.lastIndex = index;
            WORD.test(source);
            end = WORD.lastIndex;
            tokens.push({ kind: "word", text: source.slice(index, end), line });
        } else {
            end = index + 1;
            if (!/\s/.test(char)) tokens.push({ kind: "punctuation", text: char, line });
        }
        for (let at = index; at < end; at++) if (source[at] === "\n") line++;
        index = end;
    }
    return tokens;
}

function closingQuote(source: string, start: number): number {
    let quote = source[start];
    let index = start + 1;
    while (index < source.length && source[index] !== quote) {
        index += source[index] === "\\" ? 2 : 1;
    }
    return index + 1;
}
