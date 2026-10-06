import type { ImportMap } from "./types.ts";

/** Options for {@link renderImportMap}. */
export interface RenderImportMapOptions {
    /** The map to serialize, such as `ScriptEntry.importMap`. */
    value: ImportMap;
    /** A nonce from the application's existing Content Security Policy. */
    nonce?: string;
}

/**
 * Serializes an import map into an inline `<script type="importmap">` element
 * for server-rendered HTML, or `""` when the map has no mappings.
 *
 * Every `<` in the JSON is written as `\u003c`, so no key or URL can end the
 * script element; the browser parses the same strings back. The nonce is
 * written as an escaped, quoted attribute. Place the result before any
 * `modulepreload` link or module script.
 */
export function renderImportMap({ value, nonce }: RenderImportMapOptions): string {
    if (!hasMappings(value)) return "";

    let json = JSON.stringify(value).replaceAll("<", "\\u003c");
    let attributes = nonce === undefined ? "" : ` nonce="${escapeAttribute(nonce)}"`;
    return `<script type="importmap"${attributes}>${json}</script>`;
}

function hasMappings({ imports, scopes = {}, integrity = {} }: ImportMap): boolean {
    return (
        Object.keys(imports).length > 0 ||
        Object.values(scopes).some(scope => Object.keys(scope).length > 0) ||
        Object.keys(integrity).length > 0
    );
}

function escapeAttribute(text: string): string {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}
