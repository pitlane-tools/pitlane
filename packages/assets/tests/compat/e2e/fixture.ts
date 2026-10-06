// Adapted from hi-ogawa/vite-plugin-fullstack@28e9540 e2e/fixture.ts (MIT).
// Runs both import-map modes through the selected toolchain's CLI.
import assert from "node:assert";
import type { SpawnOptions } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { stripVTControlCharacters, styleText } from "node:util";
import test from "@playwright/test";
import { x } from "tinyexec";
import treeKill from "tree-kill";

const compatRoot = path.resolve(import.meta.dirname, "..");

// Vite's watcher, the chokidar 3 it bundles, emits at most one change event per
// path every 50ms and discards, rather than defers, a change inside that window
// (`_throttle(EV_CHANGE, path, 50)` in _emit:
// https://github.com/paulmillr/chokidar/blob/3.6.0/index.js#L616). Linux reports a
// rewrite at once, so a revert written as soon as a test sees its edit applied
// can land in the window and never reach the dev server.
const WATCHER_CHANGE_THROTTLE_MS = 50;

function runCli(options: { script: string; cwd: string; label: string } & SpawnOptions) {
    let require = createRequire(path.join(options.cwd, "package.json"));
    let { scripts } = require("./package.json");
    let command: string = scripts[options.script];
    if (require("vite/package.json").name === "@voidzero-dev/vite-plus-core") {
        command = command.replace(/(^|\s)vite(?=\s)/g, "$1vp");
    }
    let child = x("pnpm", ["exec", "sh", "-c", command], { nodeOptions: options }).process!;
    let label = `[${options.label}]`;
    let output = "";
    child.stdout!.on("data", data => {
        output += stripVTControlCharacters(String(data));
        if (process.env.TEST_DEBUG) console.log(styleText("cyan", label), String(data));
    });
    child.stderr!.on("data", data => {
        output += stripVTControlCharacters(String(data));
        console.log(styleText("magenta", label), String(data));
    });
    let exited = Promise.withResolvers<number | null>();
    child.on("exit", code => exited.resolve(code));
    let done = exited.promise;

    async function findPort(): Promise<number> {
        let port = Promise.withResolvers<number>();
        let check = () => {
            let match = output.match(/http:\/\/(?:localhost|\[[:\d]+\]|[\d.]+):(\d+)/);
            if (match) port.resolve(Number(match[1]));
        };
        child.stdout!.on("data", check);
        child.stderr!.on("data", check);
        void done.then(code => port.reject(new Error(`${label} exited (${code}) before listening:\n${output}`)));
        return port.promise;
    }

    return { done, findPort, output: () => output, kill: () => treeKill(child.pid!) };
}

export interface Fixture {
    mode: "dev" | "build";
    root: string;
    readonly chunkImportMap: boolean;
    url(url?: string): string;
    /**
     * Await every edit and reset: writing a file again first waits for the dev
     * server's watcher to be able to report the change.
     */
    createEditor(filepath: string): {
        edit(editFn: (data: string) => string): Promise<void>;
        reset(): Promise<void>;
    };
    createFile(filepath: string, content: string): { remove(): void };
}

export function useFixture(options: {
    example: string;
    mode: "dev" | "build";
    /** Script run to serve a build. @default "preview" */
    previewScript?: string;
    /** Script run to build. @default "build" */
    buildScript?: string;
}): Fixture {
    let cleanup: (() => Promise<void>) | undefined;
    let baseURL!: string;
    let chunkImportMap = false;
    let cwd = path.join(compatRoot, "examples", options.example);

    test.beforeAll(async ({}, testInfo) => {
        chunkImportMap = testInfo.project.metadata.chunkImportMap === true;
        let env = {
            ...process.env,
            COMPAT_CHUNK_IMPORT_MAP: chunkImportMap ? "1" : "0",
        };
        let label = `${options.example}:${options.mode}:${testInfo.project.name}`;

        if (options.mode === "build") {
            fs.rmSync(path.join(cwd, "dist"), { recursive: true, force: true });
            let build = runCli({
                script: options.buildScript ?? "build",
                label: `${label}:build`,
                cwd,
                env,
            });
            let code = await build.done;
            assert.equal(code, 0, `build failed:\n${build.output()}`);
        }

        let server = runCli({
            script: options.mode === "dev" ? "dev" : options.previewScript ?? "preview",
            label,
            cwd,
            env,
        });
        baseURL = `http://localhost:${await server.findPort()}`;
        cleanup = async () => {
            server.kill();
            await server.done;
        };
    });

    test.afterAll(async () => {
        await cleanup?.();
    });

    let originalFiles: Record<string, string> = {};
    let createdFiles = new Set<string>();
    let writtenFiles = new Set<string>();

    /**
     * Writes a watched file. Tests observe a write's effect before writing the
     * same file again, so by this call the server has emitted the previous
     * change; waiting out the watcher's window from here keeps this one.
     */
    async function write(filepath: string, content: string): Promise<void> {
        if (writtenFiles.has(filepath)) await delay(WATCHER_CHANGE_THROTTLE_MS);
        fs.writeFileSync(filepath, content);
        writtenFiles.add(filepath);
    }

    function createEditor(filepath: string) {
        filepath = path.resolve(cwd, filepath);
        let init = fs.readFileSync(filepath, "utf-8");
        originalFiles[filepath] ??= init;
        let current = init;
        return {
            async edit(editFn: (data: string) => string): Promise<void> {
                let next = editFn(current);
                assert(next !== current, "Edit function did not change the content");
                current = next;
                await write(filepath, next);
            },
            async reset(): Promise<void> {
                current = originalFiles[filepath]!;
                await write(filepath, current);
            },
        };
    }

    /** Writes a new file the suite removes afterwards, whatever the outcome. */
    function createFile(filepath: string, content: string) {
        filepath = path.resolve(cwd, filepath);
        assert(!fs.existsSync(filepath), `${filepath} already exists`);
        fs.mkdirSync(path.dirname(filepath), { recursive: true });
        fs.writeFileSync(filepath, content);
        createdFiles.add(filepath);
        return {
            remove(): void {
                fs.rmSync(filepath, { force: true });
                createdFiles.delete(filepath);
            },
        };
    }

    test.afterAll(async () => {
        for (let [filepath, content] of Object.entries(originalFiles)) {
            fs.writeFileSync(filepath, content);
        }
        for (let filepath of createdFiles) fs.rmSync(filepath, { force: true });
    });

    return {
        mode: options.mode,
        root: cwd,
        get chunkImportMap() {
            return chunkImportMap;
        },
        url: (url = "./") => new URL(url, baseURL).href,
        createEditor,
        createFile,
    };
}
