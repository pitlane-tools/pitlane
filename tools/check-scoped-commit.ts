import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Git-generated mechanical commits are exempt from the subject format.
const EXEMPT_SUBJECT = /^(?:merge[: ]|revert[: ]|fixup! |squash! )/i;

// Conventional Commits `type(scope):` is a different convention and is rejected by name,
// because its failure mode is a subject that looks correct to the author.
const CONVENTIONAL_SUBJECT = /^[A-Za-z][A-Za-z0-9-]*\([A-Za-z0-9._/-]+\)!?:\s/;

const SCOPED_SUBJECT = /^([^\s:]+):[ \t]+\S/;

const PROPOSAL_SCOPE = /^\d{4}-[a-z0-9-]+$/;

// The first line that is neither blank nor a Git comment. A message template holding nothing
// else has no subject to check.
export function subjectOf(message: string): string | null {
    for (let line of message.split(/\r?\n/)) {
        if (/^\s*(?:#|$)/.test(line)) continue;
        return line.trim();
    }
    return null;
}

export function scopeOf(subject: string): string | null {
    return subject.match(SCOPED_SUBJECT)?.[1] ?? null;
}

export function parseScopes(source: string): string[] {
    return source
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line !== "" && !line.startsWith("#"));
}

// Returns the failure message, or null when the subject is acceptable.
export function checkSubject(subject: string, allowedScopes: ReadonlySet<string>): string | null {
    if (EXEMPT_SUBJECT.test(subject)) return null;

    if (CONVENTIONAL_SUBJECT.test(subject)) {
        return "Conventional Commits 'type(scope):' subjects are not allowed; use Scoped Commits '<scope>: <imperative description>'.";
    }

    let scope = scopeOf(subject);
    if (scope === null) {
        return "subject must be a Scoped Commit: '<scope>: <imperative description>'.";
    }

    if (!allowedScopes.has(scope)) {
        return `scope '${scope}' is not allowed. Use a scope from .agents/commit-scopes or a real proposals/<NNNN>-<slug>.md filename.`;
    }

    return null;
}

function fail(message: string): never {
    console.error(`check-scoped-commit: ${message}`);
    process.exit(1);
}

export function allowedScopesFor(root: string, subject: string): Set<string> {
    let scopesFile = path.join(root, ".agents", "commit-scopes");
    let scopes = new Set(
        existsSync(scopesFile) ? parseScopes(readFileSync(scopesFile, "utf8")) : [],
    );

    // A proposal filename is the scope for the work implementing it, so the allowed set depends
    // on what this subject claims rather than on listing the whole directory.
    let scope = scopeOf(subject);
    if (
        scope !== null &&
        PROPOSAL_SCOPE.test(scope) &&
        existsSync(path.join(root, "proposals", `${scope}.md`))
    ) {
        scopes.add(scope);
    }

    return scopes;
}

function main(): void {
    let [messageFile, ...extra] = process.argv.slice(2);
    if (messageFile === undefined || extra.length > 0) {
        fail("usage: node tools/check-scoped-commit.ts <commit-message-file>");
    }

    let message: string;
    try {
        message = readFileSync(messageFile, "utf8");
    } catch {
        fail(`cannot read the commit-message file '${messageFile}'.`);
    }

    let subject = subjectOf(message);
    if (subject === null) return;

    // This script lives in `<project>/tools/`, so the check behaves the same from a hook, from
    // CI, and from a subdirectory.
    let root = path.dirname(import.meta.dirname);
    let failure = checkSubject(subject, allowedScopesFor(root, subject));
    if (failure !== null) fail(failure);
}

if (import.meta.main) main();
