import { fileURLToPath } from "node:url";

import { check as codeFences } from "./policies/code-fences.ts";
import { check as declarations } from "./policies/declarations.ts";
import { check as dependencies } from "./policies/dependencies.ts";
import { check as importStyle } from "./policies/import-style.ts";
import { check as readme } from "./policies/readme.ts";

// Source rules, such as policy.0006's, are Oxlint rules in tools/lint/ instead.
const CHECKS = [dependencies, declarations, readme, codeFences, importStyle];

let root = fileURLToPath(new URL("..", import.meta.url));
let violations = CHECKS.flatMap(check => check(root));

for (let violation of violations) console.log(violation);
if (violations.length > 0) {
    console.log(`${violations.length} violation${violations.length === 1 ? "" : "s"}`);
    process.exitCode = 1;
} else {
    console.log("Policies hold: 0 violations");
}
