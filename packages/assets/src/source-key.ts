/**
 * Reduces any accepted spelling of a source module to its portable key: the
 * slash-separated path from the project root, such as `app/counter.tsx` or,
 * for a linked module outside the root, `../shared/widget.ts`.
 *
 * `./`, a leading `/` (a project-root marker), `file:`, and an `#export`
 * fragment are dropped, and dot segments collapse lexically. Returns `null`
 * for an absolute file URL, whose meaning depends on the machine that wrote
 * it.
 */
export function normalizeSourceKey(path: string): string | null {
    let key = path;
    let fragment = key.indexOf("#");
    if (fragment !== -1) key = key.slice(0, fragment);

    if (key.startsWith("file:")) {
        key = key.slice("file:".length);
        if (key.startsWith("/")) return null;
    }

    let segments: string[] = [];
    for (let segment of key.split("/")) {
        if (segment === "" || segment === ".") continue;
        if (segment === ".." && segments.length > 0 && segments.at(-1) !== "..") {
            segments.pop();
        } else {
            segments.push(segment);
        }
    }
    return segments.join("/");
}
