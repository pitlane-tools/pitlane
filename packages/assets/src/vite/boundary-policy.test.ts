import * as fc from "fast-check";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createBrowserBoundary } from "./boundary-policy.ts";

let root: string;

beforeAll(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "pitlane-boundary-")));
    await mkdir(join(root, "app/public"), { recursive: true });
    let packages = {
        widget: { optionalDependencies: { optional: "1.0.0", absent: "1.0.0" } },
        optional: { dependencies: { nested: "1.0.0" } },
        nested: {},
    };
    for (let [name, manifest] of Object.entries(packages)) {
        await mkdir(join(root, "node_modules", name), { recursive: true });
        await writeFile(
            join(root, "node_modules", name, "package.json"),
            JSON.stringify({ name, version: "1.0.0", ...manifest }),
        );
    }
});

afterAll(() => rm(root, { recursive: true, force: true }));

let segment = fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/);
let file = fc.tuple(fc.array(segment, { maxLength: 3 }), segment).map(([dirs, name]) => ({
    dirs,
    name,
}));

describe("#75: browser boundary matching", () => {
    it("denies every file denyFiles matches, whatever allowFiles says", () => {
        let inspect = createBrowserBoundary(root, {
            allowFiles: ["app/**"],
            denyFiles: ["app/**/*.test.*"],
        });
        fc.assert(
            fc.property(file, ({ dirs, name }) => {
                let path = join(root, "app", ...dirs, `${name}.test.ts`);
                expect(inspect(path)).toEqual({ allowed: false, deniedBy: "app/**/*.test.*" });
            }),
        );
    });

    it("allows every file below a directory allowFiles names without a glob", () => {
        let inspect = createBrowserBoundary(root, { allowFiles: ["app/public"] });
        fc.assert(
            fc.property(file, ({ dirs, name }) => {
                expect(inspect(join(root, "app/public", ...dirs, `${name}.ts`))).toEqual({
                    allowed: true,
                });
                expect(inspect(join(root, "app/public-other", ...dirs, `${name}.ts`))).toEqual({
                    allowed: false,
                });
            }),
        );
    });

    it("resolves relative patterns from the root and matches absolute ones as written", () => {
        let inspect = createBrowserBoundary(root, {
            allowFiles: ["app/routes.ts", join(root, "app/entry.ts")],
        });

        expect(inspect(join(root, "app/routes.ts"))).toEqual({ allowed: true });
        expect(inspect(join(root, "app/entry.ts"))).toEqual({ allowed: true });
        expect(inspect(join(root, "app/routes.tsx"))).toEqual({ allowed: false });
    });

    it("allows installed optional dependencies and their dependencies, and skips absent ones", () => {
        let inspect = createBrowserBoundary(root, { allowFiles: [], allowPackages: ["widget"] });

        for (let name of ["widget", "optional", "nested"]) {
            expect(inspect(join(root, "node_modules", name, "index.js"))).toEqual({
                allowed: true,
            });
        }
    });

    it("lets denyFiles refuse a file an allowed package holds", () => {
        let inspect = createBrowserBoundary(root, {
            allowFiles: [],
            allowPackages: ["widget"],
            denyFiles: ["node_modules/widget/server/**"],
        });

        expect(inspect(join(root, "node_modules/widget/server/token.js"))).toEqual({
            allowed: false,
            deniedBy: "node_modules/widget/server/**",
        });
        expect(inspect(join(root, "node_modules/widget/client.js"))).toEqual({ allowed: true });
    });

    it("allows the runtime helpers a compiler injects, as remix/assets does", () => {
        let inspect = createBrowserBoundary(root, { allowFiles: [] });

        expect(
            inspect(join(root, "node_modules/@oxc-project/runtime/src/helpers/decorate.js")),
        ).toEqual({ allowed: true });
    });

    it("trims surrounding whitespace from allowPackages names, as remix/assets does", () => {
        let inspect = createBrowserBoundary(root, { allowFiles: [], allowPackages: [" widget "] });

        expect(inspect(join(root, "node_modules/widget/index.js"))).toEqual({ allowed: true });
    });
});
