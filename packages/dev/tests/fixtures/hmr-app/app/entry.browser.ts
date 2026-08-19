import { run } from "remix/ui";

// Recorded so the browser suite can assert which revalidation mechanism ran: a
// navigation fallback shows up here, a direct frame reload does not.
let navigations: string[] = [];
(globalThis as unknown as { __navigations: string[] }).__navigations = navigations;
navigation.addEventListener("navigate", event => {
    navigations.push(event.navigationType);
});

run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(/* @vite-ignore */ moduleUrl);
        return mod[exportName];
    },
});
