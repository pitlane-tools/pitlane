import { run } from "remix/ui";

run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(/* @vite-ignore */ moduleUrl);
        return mod[exportName];
    },
    // This fixture exercises GET frame navigation, not form submissions.
    resolveFrame(src, options) {
        let headers = new Headers({ accept: "text/html", "x-remix-frame": "true" });
        if (options?.target) headers.set("x-remix-target", options.target);
        return fetch(src, { headers, signal: options?.signal });
    },
});
