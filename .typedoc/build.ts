import { execFileSync } from "node:child_process";

// One process for every package so the build caches them as one unit. Each run
// merges its entries into the shared docs/.generated/reference*.json files, and
// caching the runs separately let a replay restore a stale copy of them.
const CONFIGS = ["content", "crawler", "data-table-d1", "dev", "theme"];

for (let config of CONFIGS) {
    execFileSync("./node_modules/.bin/typedoc", ["--options", `${config}.json`], {
        cwd: import.meta.dirname,
        stdio: "inherit",
    });
}
