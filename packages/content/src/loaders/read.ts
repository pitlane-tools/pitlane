/**
 * Parses one file, naming it when the parse fails.
 *
 * Malformed frontmatter and malformed JSON are the two most likely authoring
 * mistakes here, and the parsers report a line and column relative to the
 * snippet they were handed. Without the path that is unactionable in a
 * collection of any size.
 */
export function read<Parsed>(
    parse: (text: string) => Parsed,
    text: string,
    filePath: string,
): Parsed {
    try {
        return parse(text);
    } catch (error) {
        let cause = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse "${filePath}": ${cause}`, { cause: error });
    }
}
