import type { ResolvedConfig } from "vite";

import type { ImportMap } from "../types.ts";
import type { BrowserInput } from "./entries.ts";
import type { CapturedOutput } from "./output.ts";

import { assetsSpecifier, quotedList } from "../specifier.ts";

export interface AssetPluginState {
    config?: ResolvedConfig;
    serverEnvironments: string[];
    inputs: Map<string, BrowserInput>;
    registrations: Map<string, Map<string, string[]>>;
    onRegistrationChange?: (environment: string, owner: string) => void;
    assetReferences: Map<string, string>;
    outputs: Map<string, CapturedOutput>;
    importMap?: ImportMap;
    mapsEnabled: boolean;
}

export const MANIFEST_FILE = "__pitlane_assets_manifest.js";
export const MANIFEST_ID = "\0pitlane:assets-manifest";
export const MANIFEST_EXTERNAL = "pitlane:assets-build-manifest";
export const EMPTY_INPUT = "\0pitlane:assets-empty-input";

/** The manifest was imported from a server environment `assets()` does not serve. */
export function unservedEnvironmentError(name: string, served: string[]): Error {
    return new Error(
        `[assets] The "${name}" environment imported ${assetsSpecifier("manifest")}, but assets() serves only ` +
            `${quotedList(served, "conjunction")}. Add "${name}" to assets({ serverEnvironments }) from ${assetsSpecifier("vite-plugin")}.`,
    );
}
