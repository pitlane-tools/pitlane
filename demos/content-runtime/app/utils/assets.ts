import { createAssetServer } from "remix/assets";

/**
 * The asset server, which is the whole build step this demo has.
 *
 * It compiles TypeScript and JSX on demand and serves the result, but it does
 * not rewrite bare specifiers: a served module still imports `remix/ui` by
 * name, and the import map each script entry carries is what resolves it.
 */
export const assets = createAssetServer({
    basePath: "/assets",
    rootDir: process.cwd(),
    // Browser-reachable source lives under a `public/` directory beside its
    // owner. `remix` is allowed because the served modules import `remix/ui`
    // and its JSX runtime.
    allowFiles: ["app/**/public/**"],
    allowPackages: ["remix"],
});
