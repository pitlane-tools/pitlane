import type { StandardSchemaIssue, StandardSchemaV1 } from "./types.ts";

interface ParseTarget {
    collection: string;
    id: string;
    filePath?: string;
}

/**
 * Validates one entry's data against its collection's schema.
 *
 * The thrown message names everything needed to find the file and fix it: the
 * entry, the collection, the path when there is one, and one line per issue.
 * This is the earliest point the data exists, so it is the earliest point the
 * mistake can be reported.
 */
export async function parseEntryData<D>(
    schema: StandardSchemaV1,
    target: ParseTarget,
    data: unknown,
): Promise<D> {
    let result = await schema["~standard"].validate(data);
    if (result.issues) throw new Error(parseFailure(target, result.issues));
    return result.value as D;
}

function parseFailure(target: ParseTarget, issues: readonly StandardSchemaIssue[]): string {
    let where = target.filePath ? ` (${target.filePath})` : "";
    let lines = issues.map(issue => `  - ${issuePath(issue)}${issue.message}`);
    return [
        `Failed to parse entry "${target.id}" in collection "${target.collection}"${where}:`,
        ...lines,
    ].join("\n");
}

function issuePath(issue: StandardSchemaIssue): string {
    if (!issue.path || issue.path.length === 0) return "";
    let segments = issue.path.map(segment =>
        typeof segment === "object" ? String(segment.key) : String(segment),
    );
    return `${segments.join(".")}: `;
}
