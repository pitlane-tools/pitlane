import { posix } from "node:path";
import { describe, expect, it, vi } from "vitest";

// Exercise Windows filesystem paths on every runner, matching Vite's documented
// forward-slash module IDs even when the host uses POSIX paths.
vi.mock("node:path", async importOriginal => {
    let path = await importOriginal<typeof import("node:path")>();
    return { ...path, resolve: path.win32.resolve };
});
vi.mock("node:url", async importOriginal => {
    let url = await importOriginal<typeof import("node:url")>();
    return {
        ...url,
        fileURLToPath: (path: string) => url.fileURLToPath(path, { windows: true }),
    };
});
vi.mock("vite", () => ({
    normalizePath: (path: string) => posix.normalize(path.replaceAll("\\", "/")),
}));

import { inputPath } from "../src/vite/entries.ts";

describe("Windows browser input module IDs", () => {
    it.each([
        "src/entry.browser.ts",
        "src/entry.browser.ts#app",
        "file:src/entry.browser.ts",
        "file:///C:/remix-app/src/entry.browser.ts",
    ])("uses Vite's canonical ID for %s", key => {
        expect(inputPath("C:/remix-app", key)).toBe("C:/remix-app/src/entry.browser.ts");
    });
});
