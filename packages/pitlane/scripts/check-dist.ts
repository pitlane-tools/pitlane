// Fails the build when an `exports` entry names a file the build did not emit,
// which would otherwise surface only as an install that cannot import it.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

let directory = resolve(import.meta.dirname, "..");
let { exports } = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
let missing = Object.entries(exports as Record<string, Record<string, string>>).flatMap(
    ([subpath, conditions]) =>
        Object.values(conditions)
            .filter(file => !existsSync(join(directory, file)))
            .map(file => `${subpath}: ${file}`),
);

if (missing.length > 0) {
    console.error(`Built output is missing exported files:\n- ${missing.join("\n- ")}`);
    process.exit(1);
}
