import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { createFilter, normalizePath } from "vite";

/** The browser boundary options, named and read as `remix/assets` reads them. */
export interface BrowserBoundaryOptions {
    allowFiles: string[];
    allowPackages?: string[];
    denyFiles?: string[];
}

/** Whether a file may reach the browser, and the `denyFiles` pattern that refused an allowed one. */
export type BoundaryVerdict = { allowed: true } | { allowed: false; deniedBy?: string };

type FileMatcher = (file: string) => boolean;

/**
 * Builds the access check `remix/assets` applies to the files it serves.
 * `root` is a real path; files passed to the check are real absolute paths.
 */
export function createBrowserBoundary(
    root: string,
    options: BrowserBoundaryOptions,
): (file: string) => BoundaryVerdict {
    let allowMatchers = options.allowFiles.map(pattern => fileMatcher(root, pattern));
    let denyMatchers = (options.denyFiles ?? []).map(pattern => ({
        pattern,
        matches: fileMatcher(root, pattern),
    }));
    let packageRoots = allowedPackageRoots(
        root,
        (options.allowPackages ?? []).map(name => name.trim()),
    );
    return file => {
        // Compilers inject imports of these helpers into authored code, so
        // `remix/assets` serves them whatever the options say.
        if (file.includes("/node_modules/@oxc-project/runtime/")) return { allowed: true };
        let allowed =
            allowMatchers.some(matches => matches(file)) ||
            packageRoots.some(directory => within(directory, file));
        if (!allowed) return { allowed: false };
        let denial = denyMatchers.find(({ matches }) => matches(file));
        return denial ? { allowed: false, deniedBy: denial.pattern } : { allowed: true };
    };
}

/** Whether `file` is `directory` or below it. */
export function within(directory: string, file: string): boolean {
    return file === directory || file.startsWith(`${directory}/`);
}

function fileMatcher(root: string, pattern: string): FileMatcher {
    let path = normalizePath(isAbsolute(pattern) ? pattern : join(root, pattern));
    if (/[*?[\]{}()!+@]/.test(pattern)) return createFilter(path, null, { resolve: false });
    if (!existsSync(path)) return file => file === path;
    let real = normalizePath(realpathSync(path));
    return statSync(real).isDirectory() ? file => within(real, file) : file => file === real;
}

/** Whether `name` is a bare or scoped package name, not a path, as `remix/assets` requires. */
function isPackageName(name: string): boolean {
    let scoped = name.startsWith("@");
    let parts = (scoped ? name.slice(1) : name).split("/");
    return (
        parts.length === (scoped ? 2 : 1) &&
        parts.every(part => /^[\w.~-]+$/.test(part) && part !== "." && part !== "..")
    );
}

/**
 * The real directories of each named package and of everything its
 * `dependencies` and installed `optionalDependencies` pull in, transitively.
 * Peer dependencies are left out, as `remix/assets` leaves them out.
 */
function allowedPackageRoots(root: string, names: string[]): string[] {
    let roots = new Set<string>();
    let pending = names.map(name => {
        if (!isPackageName(name)) {
            throw new Error(
                `[assets] allowPackages values must be package names. Received ${JSON.stringify(name)}.`,
            );
        }
        let directory = packageDirectory(name, root);
        if (!directory) throw new Error(`[assets] Could not resolve allowed package "${name}".`);
        return directory;
    });
    while (pending.length > 0) {
        let directory = pending.pop()!;
        if (roots.has(directory)) continue;
        roots.add(directory);
        let manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
        for (let name of Object.keys(manifest.dependencies ?? {})) {
            let dependency = packageDirectory(name, directory);
            if (!dependency) {
                throw new Error(
                    `[assets] Could not resolve dependency "${name}" of allowed package ${directory}.`,
                );
            }
            pending.push(dependency);
        }
        for (let name of Object.keys(manifest.optionalDependencies ?? {})) {
            let dependency = packageDirectory(name, directory);
            if (dependency) pending.push(dependency);
        }
    }
    return [...roots];
}

/** The real directory Node's lookup finds for package `name` from `from`, or `undefined`. */
function packageDirectory(name: string, from: string): string | undefined {
    for (let directory = from; ; directory = dirname(directory)) {
        let candidate = join(directory, "node_modules", name);
        if (existsSync(join(candidate, "package.json")))
            return normalizePath(realpathSync(candidate));
        if (dirname(directory) === directory) return undefined;
    }
}
