import { run } from "remix/component";

import { revalidate } from "../../../../src/hmr-client.ts";

let app = run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(/* @vite-ignore */ moduleUrl);
        return mod[exportName];
    },
});

if (import.meta.hot) {
    import.meta.hot.on("server:update", () => revalidate(app));
}
