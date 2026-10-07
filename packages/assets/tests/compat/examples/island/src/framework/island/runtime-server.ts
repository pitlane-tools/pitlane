// cf. astro preact integration
// https://github.com/withastro/astro/blob/63ca266b9039ed241ee5257d1b2e6b2337a041c9/packages/integrations/preact/src/server.ts

import type { ScriptEntry } from "@pitlane/assets";
import { type ComponentType, Fragment, h } from "preact";
import { renderToStaticMarkup } from "preact-render-to-string";

export function createIsland(
  Component: ComponentType,
  exportName: string,
  entry: ScriptEntry,
): ComponentType {
  const Wrapper: ComponentType = (props) => {
    const markup = renderToStaticMarkup(h(Component, props));
    // The island's own chunk and its static imports, hinted beside the island
    // because the head has already streamed by the time it renders.
    return h(Fragment, null, [
      ...entry.preloads.map((href) =>
        h("link", { key: href, rel: "modulepreload", href }),
      ),
      h("demo-island", {
        entry: entry.href,
        "export-name": exportName,
        props: JSON.stringify(props),
        dangerouslySetInnerHTML: { __html: markup },
      }),
    ]);
  };
  Object.defineProperty(Wrapper, "name", {
    value: Component.displayName || Component.name,
  });
  return Wrapper;
}
