import type { InstallAlternative } from "./components/install-group.tsx";

import { renderCode } from "../build/expressive-code.ts";
import { type PackageManager, PREFERENCE_CHOICES } from "./document.ts";

export interface InstallSpec {
    /** Runtime dependencies. */
    packages?: readonly string[];
    /** Development dependencies, installed with `-D`. */
    dev?: readonly string[];
}

/** How `manager` names the npm package `name`: Deno needs the registry prefix; the rest take it as is. */
export function packageSpecifier(manager: PackageManager, name: string): string {
    return manager === "deno" ? `npm:${name}` : name;
}

/** Await at MDX module scope so the synchronous InstallGroup receives prepared code. */
export async function installAlternatives({
    packages = [],
    dev = [],
}: InstallSpec): Promise<InstallAlternative[]> {
    if (packages.length === 0 && dev.length === 0) {
        throw new Error("An install group needs at least one package in `packages` or `dev`.");
    }
    return Promise.all(
        PREFERENCE_CHOICES.packageManager.map(async manager => {
            let command = [
                { add: `${manager} add`, names: packages },
                { add: `${manager} add -D`, names: dev },
            ]
                .filter(line => line.names.length > 0)
                .map(line =>
                    [line.add, ...line.names.map(name => packageSpecifier(manager, name))].join(
                        " ",
                    ),
                )
                .join("\n");
            // The install group's tabs head the command in place of a terminal frame.
            let html = await renderCode(command, "sh", "An install group", 'frame="none"');
            return { manager, html, lines: command.split("\n").length };
        }),
    );
}
