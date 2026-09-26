import type { ContentLoader } from "@pitlane/content";

/** One published reference page, as `mise run docs:api` describes it. */
interface ReferencePage {
    url: string;
    title: string;
    description: string;
    module: string;
    kind: string;
    /** The generated Markdown, relative to the repository. */
    sourcePath: string;
    aliases: { module: string; name: string }[];
}

/**
 * Loads the generated API reference: one entry per page listed in the
 * manifest, identified by its URL below `/package/`, with the generated
 * Markdown as its body for `contentLayer()` to compile.
 *
 * `manifest` is the manifest path and `repository` the directory its
 * `sourcePath` values are relative to, both resolved against the content root.
 */
export function reference(options: { manifest: string; repository: string }): ContentLoader {
    let watched: string[] = [];

    return {
        name: "reference",
        async load(context) {
            // The built renderer uses the content manifest and never runs this filesystem loader.
            let [{ readFile }, { resolve }] = await Promise.all([
                import("node:fs/promises"),
                import("node:path"),
            ]);
            let manifest = resolve(context.root, options.manifest);
            let repository = resolve(context.root, options.repository);
            let pages = JSON.parse(await readFile(manifest, "utf8")) as ReferencePage[];
            watched = [manifest, ...pages.map(page => resolve(repository, page.sourcePath))];

            for (let { sourcePath, ...page } of pages) {
                let id = page.url.replace(/^\/package\//, "").replace(/\/$/, "");
                let filePath = resolve(repository, sourcePath);
                context.store.set({
                    id,
                    data: await context.parseData({ id, data: page, filePath }),
                    filePath,
                    body: { format: "md", source: await readFile(filePath, "utf8") },
                });
            }
        },
        watchedPaths: () => watched,
    };
}
