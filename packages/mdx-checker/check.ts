// Typechecks every MDX document of one or more TypeScript projects by driving
// the same MDX language server VS Code runs, headlessly over stdio.
//
//   node packages/mdx-checker/check.ts [tsconfig.json ...]     default: docs/tsconfig.json
//
// A document is bound to the nearest ancestor tsconfig.json that includes it,
// exactly as in the editor, so the project has to live above the documents and
// carry `"mdx": { "checkMdx": true }`; without that key the server reports
// nothing at all, which is why both are verified instead of assumed.
import type {
    Diagnostic,
    DiagnosticSeverity,
    FullDocumentDiagnosticReport,
    NotificationType,
    Range,
    RequestType,
    TextDocumentIdentifier,
} from "vscode-languageserver-protocol/node.js";

import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import protocol from "vscode-languageserver-protocol/node.js";

let require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MDX_EXTENSIONS: ts.FileExtensionInfo[] = [
    { extension: "mdx", isMixedContent: true, scriptKind: ts.ScriptKind.Deferred },
];
const SEVERITY_LABELS: Record<DiagnosticSeverity, string> = {
    1: "error",
    2: "warning",
    3: "info",
    4: "hint",
};
const MATCH_TSCONFIG_REQUEST = new protocol.RequestType<
    TextDocumentIdentifier,
    { uri: string } | null | undefined,
    never
>("volar/client/tsconfig");

class CheckError extends Error {}

interface Project {
    tsconfig: string;
    documents: string[];
}

interface Server {
    versions: string;
    tsdk: string;
    request<P, R, E>(type: RequestType<P, R, E>, params: P): Promise<R>;
    notify<P>(type: NotificationType<P>, params: P): Promise<void>;
    stop(): Promise<void>;
}

function display(fileName: string): string {
    return path.relative(process.cwd(), fileName) || ".";
}

function flatten(diagnostic: ts.Diagnostic): string {
    return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}

function readProject(tsconfigPath: string): Project {
    let tsconfig = path.resolve(tsconfigPath);
    let { config, error } = ts.readConfigFile(tsconfig, ts.sys.readFile);
    if (error) {
        throw new CheckError(`${display(tsconfig)}: ${flatten(error)}`);
    }
    if (config.mdx?.checkMdx !== true) {
        throw new CheckError(
            `${display(tsconfig)}: needs "mdx": { "checkMdx": true }, otherwise the language server typechecks nothing.`,
        );
    }
    let parsed = ts.parseJsonConfigFileContent(
        config,
        ts.sys,
        path.dirname(tsconfig),
        undefined,
        tsconfig,
        undefined,
        MDX_EXTENSIONS,
    );
    let fatal = parsed.errors.filter(
        diagnostic => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    if (fatal.length > 0) {
        throw new CheckError(`${display(tsconfig)}: ${fatal.map(flatten).join("\n")}`);
    }
    let documents = parsed.fileNames.filter(fileName => fileName.endsWith(".mdx")).sort();
    if (documents.length === 0) {
        throw new CheckError(`${display(tsconfig)}: no MDX documents match its include patterns.`);
    }
    return { tsconfig, documents };
}

function startServer(): Server {
    // The package exports only its entry module, which is also its bin.
    let serverBin = require.resolve("@mdx-js/language-server");
    let serverVersion = JSON.parse(ts.sys.readFile(path.join(serverBin, "../../package.json"))!)
        .version as string;
    let tsdk = path.dirname(require.resolve("typescript"));
    let child = spawn(process.execPath, [serverBin, "--stdio"], {
        cwd: REPO_ROOT,
        stdio: ["pipe", "pipe", "inherit"],
    });
    let exit = once(child, "exit");
    let connection = protocol.createProtocolConnection(
        new protocol.StreamMessageReader(child.stdout),
        new protocol.StreamMessageWriter(child.stdin),
    );
    // A request never settles once the server is gone, so every request races
    // against the connection closing.
    let closedEarly = false;
    let closed = new Promise<never>((_, reject) => {
        connection.onClose(() => {
            closedEarly = true;
            reject(new CheckError("mdx-language-server exited before the check finished."));
        });
    });
    closed.catch(() => {});
    connection.onNotification(protocol.LogMessageNotification.type, ({ type, message }) => {
        if (type === protocol.MessageType.Error) console.error(`mdx-language-server: ${message}`);
    });
    connection.listen();

    return {
        versions: `mdx-language-server ${serverVersion}, typescript ${ts.version}`,
        tsdk,
        request: (type, params) => Promise.race([connection.sendRequest(type, params), closed]),
        notify: (type, params) => connection.sendNotification(type, params),
        async stop() {
            if (!closedEarly) {
                await Promise.race([connection.sendRequest(protocol.ShutdownRequest.type), closed]);
                await connection.sendNotification(protocol.ExitNotification.type);
            }
            connection.dispose();
            await exit;
        },
    };
}

async function initialize(server: Server): Promise<void> {
    let rootUri = pathToFileURL(REPO_ROOT).href;
    await server.request(protocol.InitializeRequest.type, {
        processId: process.pid,
        rootUri,
        workspaceFolders: [{ uri: rootUri, name: path.basename(REPO_ROOT) }],
        initializationOptions: { typescript: { enabled: true, tsdk: server.tsdk } },
        capabilities: {},
    });
    await server.notify(protocol.InitializedNotification.type, {});
}

async function diagnose(
    server: Server,
    fileName: string,
    expectedTsconfig: string,
): Promise<Diagnostic[]> {
    let uri = pathToFileURL(fileName).href;
    await server.notify(protocol.DidOpenTextDocumentNotification.type, {
        textDocument: { uri, languageId: "mdx", version: 1, text: ts.sys.readFile(fileName)! },
    });
    let match = await server.request(MATCH_TSCONFIG_REQUEST, { uri });
    let boundTo = match ? display(path.resolve(fileURLToPath(match.uri))) : "no project";
    if (boundTo !== display(expectedTsconfig)) {
        throw new CheckError(
            `${display(fileName)}: the language server bound it to ${boundTo}, not ${display(expectedTsconfig)}.`,
        );
    }
    // Without a previousResultId the server can only answer with a full report.
    let report = (await server.request(protocol.DocumentDiagnosticRequest.type, {
        textDocument: { uri },
    })) as FullDocumentDiagnosticReport;
    await server.notify(protocol.DidCloseTextDocumentNotification.type, { textDocument: { uri } });
    return report.items;
}

function location(fileName: string, { start }: Range): string {
    return `${display(fileName)}:${start.line + 1}:${start.character + 1}`;
}

function formatDiagnostic(fileName: string, diagnostic: Diagnostic): string {
    let severity = SEVERITY_LABELS[diagnostic.severity ?? protocol.DiagnosticSeverity.Error];
    let code =
        diagnostic.source === "ts"
            ? `TS${diagnostic.code}`
            : `${diagnostic.source} ${diagnostic.code ?? ""}`.trim();
    let lines = [
        `${location(fileName, diagnostic.range)} - ${severity} ${code}: ${diagnostic.message}`,
    ];
    for (let { location: related, message } of diagnostic.relatedInformation ?? []) {
        lines.push(`    ${location(fileURLToPath(related.uri), related.range)} - ${message}`);
    }
    return lines.join("\n");
}

function byPosition(a: Diagnostic, b: Diagnostic): number {
    return (
        a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character
    );
}

async function main(args: string[]): Promise<number> {
    let projects = (args.length > 0 ? args : [path.join(REPO_ROOT, "docs/tsconfig.json")]).map(
        readProject,
    );
    let server = startServer();
    let errors = 0;
    let checked = 0;
    try {
        await initialize(server);
        for (let { tsconfig, documents } of projects) {
            for (let fileName of documents) {
                let diagnostics = await diagnose(server, fileName, tsconfig);
                checked += 1;
                for (let diagnostic of diagnostics.sort(byPosition)) {
                    if (diagnostic.severity === protocol.DiagnosticSeverity.Error) errors += 1;
                    console.log(formatDiagnostic(fileName, diagnostic));
                }
            }
        }
    } finally {
        await server.stop();
    }
    let plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
    console.log(
        `${plural(errors, "error")} in ${plural(checked, "MDX document")} (${server.versions})`,
    );
    return errors === 0 ? 0 : 1;
}

try {
    process.exitCode = await main(process.argv.slice(2));
} catch (error) {
    if (!(error instanceof CheckError)) throw error;
    console.error(error.message);
    process.exitCode = 2;
}
