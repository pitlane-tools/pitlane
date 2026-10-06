import { run } from "remix/component";

import { revalidate } from "../../../../src/hmr-client.ts";

// Recorded so the browser suite can assert which revalidation mechanism ran: a
// navigation fallback shows up here, a direct frame reload does not.
let navigations: string[] = [];
(globalThis as unknown as { __navigations: string[] }).__navigations = navigations;
navigation.addEventListener("navigate", event => {
    navigations.push(event.navigationType);
});

let app = run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(/* @vite-ignore */ moduleUrl);
        return mod[exportName];
    },
});

if (import.meta.hot) {
    import.meta.hot.on("server:update", () => revalidate(app));
}
