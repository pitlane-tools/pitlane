// Points every `@pitlane/*` dependency in this isolated compatibility
// workspace at a candidate artifact instead of the npm registry, and lets the
// toolchain check swap the `vite` version without editing any manifest.
//
//   PITLANE_SPEC_ASSETS=<tarball path | pkg.pr.new URL | file:dir>
//   PITLANE_SPEC_VITE_PLUGIN_FETCH_SERVER=...
//   PITLANE_SPEC_VITE_PLUGIN_REMIX=...
//   PITLANE_SPEC_CRAWLER=...            (transitive dependency of the Remix plugin)
//   PITLANE_COMPAT_VITE=8.1.0 | npm:@voidzero-dev/vite-plus-core@1.0.0
//
// An unset package variable falls back to the package directory in this
// checkout, which must have been built (`vp run build`) beforehand.
const path = require("node:path");

const packagesDir = path.resolve(__dirname, "../../..");

function candidate(name) {
    let short = name.slice("@pitlane/".length);
    let variable = `PITLANE_SPEC_${short.toUpperCase().replaceAll("-", "_")}`;
    let value = process.env[variable];
    if (value) {
        return /^(file:|link:|https?:|npm:)/.test(value) ? value : `file:${path.resolve(value)}`;
    }
    return `file:${path.join(packagesDir, short)}`;
}

function rewrite(dependencies) {
    if (!dependencies) return;
    for (let name of Object.keys(dependencies)) {
        if (name.startsWith("@pitlane/")) dependencies[name] = candidate(name);
        if (name === "vite" && process.env.PITLANE_COMPAT_VITE) {
            dependencies[name] = process.env.PITLANE_COMPAT_VITE;
        }
    }
}

module.exports = {
    hooks: {
        readPackage(pkg) {
            rewrite(pkg.dependencies);
            rewrite(pkg.devDependencies);
            rewrite(pkg.optionalDependencies);
            return pkg;
        },
    },
};
