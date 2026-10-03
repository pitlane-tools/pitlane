import { describe, expect, it } from "vite-plus/test";

import { exportShape, liftPeers } from "../scripts/umbrella.ts";

describe("exportShape", () => {
    it("reads a module without a default export", () => {
        let source = `export { crawl } from "./crawl.ts";\nexport type { Page } from "./types.ts";\n`;
        expect(exportShape(source, "index.ts")).toEqual({ kind: "module", hasDefault: false });
    });

    it("sees a default export written as a declaration", () => {
        let source = `export default function plugin() {}\n`;
        expect(exportShape(source, "index.ts")).toEqual({ kind: "module", hasDefault: true });
    });

    it("sees a default export written as a renamed binding", () => {
        let source = `function plugin() {}\nexport { plugin as default };\n`;
        expect(exportShape(source, "index.ts")).toEqual({ kind: "module", hasDefault: true });
    });

    it("does not mistake a default export inside a doc comment for one", () => {
        let source = `/**\n * export default defineConfig({})\n */\nexport function remix() {}\n`;
        expect(exportShape(source, "index.ts")).toEqual({ kind: "module", hasDefault: false });
    });

    it("reads a declaration file with no module syntax as ambient", () => {
        let source = `declare module "*?assets=client" {\n    let assets: import("./runtime").Assets;\n}\n`;
        expect(exportShape(source, "assets.d.ts")).toEqual({ kind: "ambient" });
    });
});

describe("liftPeers", () => {
    it("keeps a range every package agrees on", () => {
        let lifted = liftPeers([
            { name: "@pitlane/theme", peerDependencies: { remix: "^3.0.0" } },
            { name: "@pitlane/crawler", peerDependencies: { remix: "^3.0.0" } },
        ]);
        expect(lifted.peerDependencies).toEqual({ remix: "^3.0.0" });
        expect(lifted.peerDependenciesMeta).toEqual({});
    });

    it("takes the narrower range when one package's range contains the other's", () => {
        let lifted = liftPeers([
            { name: "@pitlane/dev", peerDependencies: { vite: ">=7.0.0" } },
            { name: "@pitlane/content", peerDependencies: { vite: ">=8.0.0" } },
        ]);
        expect(lifted.peerDependencies).toEqual({ vite: ">=8.0.0" });
    });

    it("rejects ranges where neither contains the other, naming both packages", () => {
        expect(() =>
            liftPeers([
                { name: "@pitlane/dev", peerDependencies: { vite: "^7.0.0" } },
                { name: "@pitlane/content", peerDependencies: { vite: "^8.0.0" } },
            ]),
        ).toThrow(/vite.*@pitlane\/dev.*\^7\.0\.0.*@pitlane\/content.*\^8\.0\.0/);
    });

    it("keeps a peer optional only when every package that names it lets it be", () => {
        // Installing the umbrella installs every package, so a peer one of
        // them requires is required, whichever subpaths an app imports.
        let lifted = liftPeers([
            { name: "@pitlane/dev", peerDependencies: { vite: ">=8.0.0" } },
            {
                name: "@pitlane/content",
                peerDependencies: { vite: ">=8.0.0", satteri: "^0.10.5" },
                peerDependenciesMeta: { vite: { optional: true }, satteri: { optional: true } },
            },
        ]);
        expect(lifted.peerDependencies).toEqual({ satteri: "^0.10.5", vite: ">=8.0.0" });
        expect(lifted.peerDependenciesMeta).toEqual({ satteri: { optional: true } });
    });
});
