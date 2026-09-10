import type { Expression, Function as FunctionNode, FunctionBody, Program } from "oxc-parser";
import type { Plugin } from "vite";

import MagicString from "magic-string";
import { parseSync } from "oxc-parser";
import { transformComponentsForBrowser, transformComponentsForServer } from "remix/ui-hmr";

import { SERVER_UPDATE_EVENT } from "./hmr-protocol.ts";

/**
 * Component modules Remix authors as `.tsx`/`.jsx`. The `remix/ui-hmr` transform
 * self-guards (it returns the source unchanged when a module holds no
 * `function`-form component or `clientEntry`), so this filter only trims the
 * common non-candidates — non-JSX source, query variants like `?assets=`, and
 * dependencies — before the parse cost.
 */
const COMPONENT_ID_FILTER = /\.[jt]sx$/;

/**
 * How long to wait after a server module changes before asking the browser to
 * revalidate. Vite applies the update to the server environment on its own
 * schedule; revalidating in the same tick can reach the fetch handler while the
 * server entry is still half-applied, which serves a dev error page instead of
 * the new content. The delay also coalesces bursts of saves into one refetch.
 */
const SERVER_UPDATE_SETTLE_MS = 50;

/**
 * Instruments Remix UI components and `clientEntry()` exports with the
 * `remix/ui-hmr` transforms so component edits hot-swap in place while
 * preserving live component state.
 *
 * `ui-hmr` only recognizes named-function component forms, so arrow-form
 * exports (`export let Name = clientEntry(url, (handle) => …)` and
 * `export let Name = (handle) => …`) are first normalized to named function
 * expressions — the idiomatic Remix authoring style then hot-swaps without any
 * source changes. The normalization is discarded when `ui-hmr` does not
 * instrument the module, so non-component arrows are never rewritten.
 *
 * `ui-hmr` instruments any exported PascalCase function whose body returns
 * something, which is a wider net than a Remix component: an `async` function,
 * a generator, or a plain JSX helper all match, and all three are miscompiled
 * by it. Modules holding one are left alone entirely. See
 * {@link findComponentExports}.
 *
 * The browser transform runs in the client environment and the server transform
 * in the server environment(s); both emit the standard `import.meta.hot.accept()`
 * protocol that Vite's own HMR runtime drives.
 *
 * Dev-only: production builds never carry the wrapper indirection or the runtime
 * imports.
 */
export function componentHmr(serverEnvironments: Set<string>): Plugin {
    return {
        name: "pitlane-remix-component-hmr",
        apply: "serve",
        transform: {
            filter: {
                id: {
                    include: COMPONENT_ID_FILTER,
                    exclude: /\/node_modules\//,
                },
            },
            handler(code, id) {
                let source = normalizeArrowComponents(code, id) ?? code;

                let { supported, unsupported } = findComponentExports(source, id);
                if (unsupported.length > 0) {
                    // Silent when nothing was lost: a module of plain helpers
                    // was never going to hot-swap. Worth saying when a real
                    // component is sitting next to one and now cannot.
                    if (supported.length > 0) {
                        this.warn(
                            `Component HMR is off for this module. These exports are PascalCase ` +
                                `but are not Remix component setups, which are synchronous and ` +
                                `return a render function: ${unsupported.join(", ")}. Moving or ` +
                                `renaming them lets ${supported.join(", ")} hot-swap again.`,
                        );
                    }
                    return;
                }

                let result = serverEnvironments.has(this.environment.name)
                    ? transformComponentsForServer(source, {
                          importSource: "remix",
                          moduleUrl: id,
                          sourceMap: true,
                      })
                    : transformComponentsForBrowser(source, {
                          importSource: "remix",
                          moduleUrl: id,
                          sourceMap: true,
                      });

                if (!result.transformed) return;

                return { code: result.code, map: result.map };
            },
        },
    };
}

/**
 * Server-data HMR, broadcast half: when a server-only module changes, tell the
 * browser to revalidate its server-rendered content. The `<HMR />` component
 * from the `pitlane:dev` module receives the event and reloads the top frame,
 * which refetches the page through the app's fetch handler and reconciles it,
 * keeping hydrated island state. This is the Remix 3 analog of React Router's
 * loader/action revalidation.
 *
 * A file counts as server-only when the client graph does not serve it as a
 * script; those are left to the client component-HMR boundary, so a
 * `function`-form component edit still hot-swaps instantly instead of triggering
 * a network reload. Only `js` client modules count: plugins that scan sources
 * for other reasons (Tailwind's content scanner, for one) register `asset` nodes
 * for ordinary server files, and treating those as client modules would silently
 * disable server-data HMR for the whole app.
 *
 * Dev-only. An app that never renders `<HMR />` simply has no listener, so the
 * event is inert.
 */
export function serverDataHmr(serverEnvironments: Set<string>): Plugin {
    let pending: ReturnType<typeof setTimeout> | undefined;

    return {
        name: "pitlane-remix-server-data-hmr",
        apply: "serve",

        hotUpdate({ file, server }) {
            if (!serverEnvironments.has(this.environment.name)) return;
            if (!/\.[jt]sx?$/.test(file)) return;

            let clientGraph = server.environments.client?.moduleGraph;
            let clientModules = clientGraph?.getModulesByFile(file);
            let servedToClient = [...(clientModules ?? [])].some(module => module.type === "js");
            if (servedToClient) return;

            clearTimeout(pending);
            pending = setTimeout(() => {
                pending = undefined;
                server.hot.send({ type: "custom", event: SERVER_UPDATE_EVENT });
            }, SERVER_UPDATE_SETTLE_MS);
            pending.unref?.();
        },
    };
}

/**
 * Rewrites arrow-form component and `clientEntry()` exports to named function
 * expressions so `remix/ui-hmr` can instrument them. Returns the rewritten
 * source, or `undefined` when nothing qualified.
 *
 * Handles the two idiomatic Remix arrow forms:
 *
 * - `export let Name = clientEntry(url, (handle) => …)`
 * - `export let Name = (handle) => () => <jsx/>`
 *
 * Both become `export let Name = clientEntry(url, function Name(handle) { … })`
 * / `export let Name = function Name(handle) { … }`, which is behavior-
 * identical for component setup functions (they never rely on a lexical `this`
 * or `arguments`).
 */
function normalizeArrowComponents(code: string, id: string): string | undefined {
    if (!code.includes("=>")) return;

    let program = parseSync(id, code).program;
    let rewritten: MagicString | undefined;

    for (let node of program.body) {
        if (node.type !== "ExportNamedDeclaration") continue;
        if (node.declaration?.type !== "VariableDeclaration") continue;

        for (let declarator of node.declaration.declarations) {
            if (declarator.id.type !== "Identifier") continue;
            if (!isPascalCase(declarator.id.name)) continue;
            if (!declarator.init) continue;

            let arrow = getNormalizableArrow(declarator.init);
            if (!arrow) continue;

            rewritten ??= new MagicString(code);
            let params = getParamsSource(code, arrow);
            let bodySource = code.slice(arrow.body.start, arrow.body.end);
            let block =
                arrow.body.type === "BlockStatement" ? bodySource : `{ return ${bodySource} }`;
            let asyncPrefix = arrow.async ? "async " : "";
            rewritten.overwrite(
                arrow.start,
                arrow.end,
                `${asyncPrefix}function ${declarator.id.name}${params} ${block}`,
            );
        }
    }

    return rewritten?.toString();
}

type ArrowNode = Extract<Expression, { type: "ArrowFunctionExpression" }>;

/**
 * Returns the arrow function to normalize for a component export initializer:
 * the setup argument of a `clientEntry()` call, or a bare arrow component whose
 * body returns a render function. Anything else yields `undefined`.
 */
function getNormalizableArrow(init: Expression): ArrowNode | undefined {
    if (
        init.type === "CallExpression" &&
        init.callee.type === "Identifier" &&
        init.callee.name === "clientEntry"
    ) {
        let setup = init.arguments[1];
        return setup?.type === "ArrowFunctionExpression" ? setup : undefined;
    }

    if (init.type === "ArrowFunctionExpression" && returnsRenderFunction(init)) {
        return init;
    }

    return undefined;
}

/** A Remix component setup returns a render function; that is the HMR signal. */
function returnsRenderFunction(arrow: ArrowNode): boolean {
    let body = arrow.body;
    if (body.type !== "BlockStatement") return isRenderFunction(body);
    return isRenderFunction(getRenderArgument(body));
}

/**
 * The expression `ui-hmr` hoists out of a setup body and re-registers on every
 * update: the argument of the first top-level `return`. Mirrors its own
 * `getRenderArgument`, so this module agrees with it about what it will match.
 */
function getRenderArgument(body: FunctionBody): Expression | undefined {
    let statement = body.body.find(node => node.type === "ReturnStatement");
    return statement?.argument ?? undefined;
}

function isRenderFunction(node: Expression | undefined): boolean {
    return node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
}

interface ComponentExports {
    /** Exports `ui-hmr` instruments correctly. */
    supported: string[];
    /** Exports `ui-hmr` would instrument and break. */
    unsupported: string[];
}

/**
 * Splits a module's PascalCase exports into the ones `remix/ui-hmr` can
 * instrument and the ones it would instrument but miscompile.
 *
 * All `ui-hmr` asks is whether an exported PascalCase function returns
 * something, which catches three shapes it cannot handle. An `async` setup or
 * a generator has its body moved into a plain arrow, so the `await` or `yield`
 * stops parsing and the module — along with everything importing it — fails to
 * load. A function returning an element rather than a render function is
 * rewritten to return a function, so anything calling it directly gets the
 * wrong value back. A `clientEntry()` setup with no `return` at all throws
 * inside the transform.
 *
 * Instrumentation is per module, so a single one of those turns component HMR
 * off for the whole file. Losing the hot swap beats emitting a module that
 * does not run.
 */
function findComponentExports(code: string, id: string): ComponentExports {
    let program = parseSync(id, code).program;
    let exportedNames = getExportedNames(program);
    let supported: string[] = [];
    let unsupported: string[] = [];

    for (let item of program.body) {
        let statement =
            item.type === "ExportNamedDeclaration" && item.declaration ? item.declaration : item;
        let directExport = statement !== item;

        if (statement.type === "FunctionDeclaration") {
            let name = statement.id?.name;
            if (!name || !isPascalCase(name)) continue;
            if (!directExport && !exportedNames.has(name)) continue;
            if (!statement.body || !getRenderArgument(statement.body)) continue;

            if (isComponentSetup(statement)) supported.push(name);
            else unsupported.push(name);
            continue;
        }

        if (statement.type !== "VariableDeclaration") continue;

        for (let declarator of statement.declarations) {
            if (declarator.id.type !== "Identifier") continue;
            let name = declarator.id.name;
            if (!isPascalCase(name)) continue;
            if (!directExport && !exportedNames.has(name)) continue;

            let init = declarator.init;
            if (!init) continue;

            // A `clientEntry()` setup is a candidate on sight; a bare function
            // expression only once it returns something, which is the whole of
            // what `ui-hmr` looks for.
            let setup = getClientEntrySetup(init);
            if (!setup) {
                if (init.type !== "FunctionExpression") continue;
                if (!init.body || !getRenderArgument(init.body)) continue;
                setup = init;
            }

            if (isComponentSetup(setup)) supported.push(name);
            else unsupported.push(name);
        }
    }

    return { supported, unsupported };
}

/** The documented shape: a synchronous setup that returns a render function. */
function isComponentSetup(setup: FunctionNode): boolean {
    if (setup.async || setup.generator || !setup.body) return false;
    return isRenderFunction(getRenderArgument(setup.body));
}

/**
 * The setup inside `clientEntry(url, setup)`, including the
 * `clientEntry(url, wrap(setup))` form `ui-hmr` also unwraps.
 */
function getClientEntrySetup(init: Expression): FunctionNode | undefined {
    if (init.type !== "CallExpression") return undefined;
    if (init.callee.type !== "Identifier" || init.callee.name !== "clientEntry") return undefined;

    let candidate = init.arguments[1];
    if (candidate?.type === "FunctionExpression") return candidate;
    if (candidate?.type !== "CallExpression") return undefined;

    let inner = candidate.arguments[0];
    return inner?.type === "FunctionExpression" ? inner : undefined;
}

/**
 * PascalCase names re-exported under their own name (`export { Card }`), which
 * `ui-hmr` instruments alongside `export function`. An alias
 * (`export { CardImpl as Card }`) is not one of them.
 */
function getExportedNames(program: Program): Set<string> {
    let names = new Set<string>();

    for (let item of program.body) {
        if (item.type !== "ExportNamedDeclaration") continue;
        for (let { exported, local } of item.specifiers) {
            if (local.type !== "Identifier" || exported.type !== "Identifier") continue;
            if (local.name === exported.name && isPascalCase(local.name)) names.add(local.name);
        }
    }

    return names;
}

/** Source of the arrow's parameter list, always parenthesized. */
function getParamsSource(code: string, arrow: ArrowNode): string {
    let params = arrow.params;
    if (params.length === 0) return "()";
    return `(${code.slice(params[0].start, params[params.length - 1].end)})`;
}

function isPascalCase(name: string): boolean {
    return /^[A-Z]/.test(name);
}
