import path from "node:path";

// Where one package's reference lands. `out` is fixed to <repo>/docs/package/<name>
// by every config, and that single path decides the public URL prefix, the
// manifest all packages merge into, and how `sourcePath` is expressed.
export function layoutFromOut(out) {
    let name = path.basename(out);
    let packages = path.dirname(out);
    let docs = path.dirname(packages);
    if (path.basename(packages) !== "package" || path.basename(docs) !== "docs") {
        throw new Error(`[pitlane] "out" must be <repo>/docs/package/<name>, got ${out}`);
    }
    let publicPath = `/package/${name}`;
    return {
        publicPath,
        manifest: path.join(docs, ".generated", "reference.json"),
        // "index.md" is the package root and keeps its directory URL; every
        // other page is addressed without its extension.
        urlOf(file) {
            let [page, ...fragments] = file.split("#");
            let anchor = fragments.length ? `#${fragments.at(-1)}` : "";
            let route = page.replace(/\.md$/, "");
            let pathname = route === "index" ? `${publicPath}/` : `${publicPath}/${route}`;
            return `${pathname}${anchor}`;
        },
        sourcePathOf(file) {
            return path.relative(path.dirname(docs), path.join(out, file));
        },
    };
}
