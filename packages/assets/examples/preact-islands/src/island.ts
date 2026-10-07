// The server half of an island: renders the component to static markup inside
// a <preact-island> element that tells the browser which chunk and export to
// hydrate it with. `islands-plugin.ts` wraps each island export with this.
import type { ScriptEntry } from "@pitlane/assets";
import type { ComponentType, VNode } from "preact";

import { Fragment, h } from "preact";
import { renderToString } from "preact-render-to-string";

export function createIsland<Props extends object>(
    Component: ComponentType<Props>,
    exportName: string,
    entry: ScriptEntry,
): ComponentType<Props> {
    function Island(props: Props): VNode {
        return h(Fragment, null, [
            // The island's chunk and its static imports, hinted beside the island
            // so the document never needs to know which islands a page holds.
            ...entry.preloads.map(href => h("link", { key: href, rel: "modulepreload", href })),
            h("preact-island", {
                entry: entry.href,
                "export-name": exportName,
                props: JSON.stringify(props),
                dangerouslySetInnerHTML: { __html: renderToString(h(Component, props)) },
            }),
        ]);
    }
    Island.displayName = `Island(${exportName})`;
    return Island;
}
