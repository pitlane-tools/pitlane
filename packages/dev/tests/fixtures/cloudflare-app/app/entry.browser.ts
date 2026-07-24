import { run } from "remix/ui";

run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(/* @vite-ignore */ moduleUrl);
        return mod[exportName];
    },
    async resolveFrame(src, signal) {
        let response = await fetch(src, { headers: { accept: "text/html" }, signal });
        return response.body ?? (await response.text());
    },
});
