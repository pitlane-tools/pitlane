import * as fc from "fast-check";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createBrowserBoundary } from "./boundary-policy.ts";

let root: string;

beforeAll(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "pitlane-boundary-")));
    await mkdir(join(root, "app/public"), { recursive: true });
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
});
