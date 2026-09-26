import type { InstallAlternative } from "./components/install-group.tsx";

import { renderCode } from "../build/expressive-code.ts";
import { PREFERENCE_CHOICES } from "./document.ts";

export interface InstallSpec {
    /** Runtime dependencies. */
    packages?: readonly string[];
    /** Development dependencies, installed with `-D`. */
    dev?: readonly string[];
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
            let specifier = (name: string) => (manager === "deno" ? `npm:${name}` : name);
            let command = [
                { add: `${manager} add`, names: packages },
                { add: `${manager} add -D`, names: dev },
            ]
                .filter(line => line.names.length > 0)
                .map(line => [line.add, ...line.names.map(specifier)].join(" "))
                .join("\n");
            return { manager, html: await renderCode(command, "sh", "An install group") };
        }),
    );
}
