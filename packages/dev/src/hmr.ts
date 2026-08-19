import type { Expression } from "oxc-parser";
import type { Plugin } from "vite";

import MagicString from "magic-string";
import { resolve as resolvePath } from "node:path";
import { parseSync } from "oxc-parser";
import { transformComponentsForBrowser, transformComponentsForServer } from "remix/ui-hmr";

/**
 * Component modules Remix authors as `.tsx`/`.jsx`. The `remix/ui-hmr` transform
 * self-guards (it returns the source unchanged when a module holds no
 * `function`-form component or `clientEntry`), so this filter only trims the
 * common non-candidates — non-JSX source, query variants like `?assets=`, and
 * dependencies — before the parse cost.
 */
const COMPONENT_ID_FILTER = /\.[jt]sx$/;

/** Custom Vite HMR event that asks the browser to revalidate server-rendered data. */
const SERVER_UPDATE_EVENT = "pitlane:server-update";

const DEV_CLIENT_ID = "virtual:pitlane-dev/server-data-hmr";
const RESOLVED_DEV_CLIENT_ID = `\0${DEV_CLIENT_ID}`;

/**
 * Instruments Remix UI components and `clientEntry()` exports with the
 * `remix/ui-hmr` transforms so component edits hot-swap in place while
 * preserving live component state.
 *
 * `ui-hmr` only recognizes named-function component forms, so arrow-form
 * exports (`export const Name = clientEntry(url, (handle) => …)` and
 * `export const Name = (handle) => …`) are first normalized to named function
 * expressions — the idiomatic Remix authoring style then hot-swaps without any
 * source changes. The normalization is discarded when `ui-hmr` does not
 * instrument the module, so non-component arrows are never rewritten.
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
 * Server-side data HMR: when a server-only module changes, the browser
 * revalidates its server-rendered content without a full reload, keeping
 * hydrated client-entry state intact — the Remix 3 analog of React Router's
 * loader/action hot revalidation.
 *
 * Two halves cooperate:
 *
 * - A `hotUpdate` hook on the server environment(s) detects changes to modules
 *   that live only in the server graph and broadcasts a `pitlane:server-update`
 *   event. Changes to modules that also live in the client graph are left to the
 *   client component-HMR boundary, so a `function`-form component edit still
 *   hot-swaps instantly instead of triggering a network reload.
 * - A virtual client module, injected into the client entry, listens for the
 *   event and re-navigates to the current URL. That routes through the Remix
 *   frame runtime, which re-fetches the server-rendered HTML and reconciles it
 *   in place — preserving hydrated component state the way `router.revalidate()`
 *   does under React Router.
 *
 * Dev-only, and only meaningful when a client entry exists (a fully
 * server-rendered app has no client state to preserve).
 */
export function serverDataHmr(serverEnvironments: Set<string>, clientEntry: string): Plugin {
    return {
        name: "pitlane-remix-server-data-hmr",
        apply: "serve",

        resolveId(id) {
            if (id === DEV_CLIENT_ID) return RESOLVED_DEV_CLIENT_ID;
        },

        load(id) {
            if (id === RESOLVED_DEV_CLIENT_ID) return DEV_CLIENT_SOURCE;
        },

        transform: {
            filter: { id: { include: /\.[jt]sx?$/, exclude: /\/node_modules\// } },
            handler(code, id) {
                if (serverEnvironments.has(this.environment.name)) return;
                if (!isEntryModule(id, this.environment.config.root, clientEntry)) return;

                let rewritten = new MagicString(code);
                rewritten.prepend(`import ${JSON.stringify(DEV_CLIENT_ID)};\n`);

                return {
                    code: rewritten.toString(),
                    map: rewritten.generateMap({ hires: "boundary", source: id }),
                };
            },
        },

        hotUpdate({ modules, server }) {
            if (!serverEnvironments.has(this.environment.name)) return;
            if (modules.length === 0) return;

            let clientGraph = server.environments.client?.moduleGraph;
            let hasServerOnlyChange = modules.some(mod => {
                if (!mod.file) return true;
                let clientModules = clientGraph?.getModulesByFile(mod.file);
                return !clientModules || clientModules.size === 0;
            });
            if (!hasServerOnlyChange) return;

            server.hot.send({ type: "custom", event: SERVER_UPDATE_EVENT });
        },
    };
}

/**
 * Client runtime for {@link serverDataHmr}. On a `pitlane:server-update` event it
 * re-navigates to the current URL through the Remix frame runtime, coalescing
 * overlapping reloads. Falls back to a full page reload when the frame runtime
 * cannot handle the navigation (e.g. no Navigation API).
 */
const DEV_CLIENT_SOURCE = `import { navigate } from "remix/ui";

if (import.meta.hot) {
    let inFlight = false;
    let queued = false;

    async function revalidate() {
        if (inFlight) {
            queued = true;
            return;
        }
        inFlight = true;
        try {
            await navigate(location.href, { history: "replace", resetScroll: false });
        } catch {
            location.reload();
            return;
        } finally {
            inFlight = false;
        }
        if (queued) {
            queued = false;
            revalidate();
        }
    }

    import.meta.hot.on(${JSON.stringify(SERVER_UPDATE_EVENT)}, revalidate);
}
`;

/**
 * Matches a resolved module id against the configured client entry, which the
 * user supplies without an extension (e.g. `"app/entry.browser"`).
 */
function isEntryModule(id: string, root: string, entry: string): boolean {
    let withoutQuery = id.split("?")[0];
    let withoutExtension = withoutQuery.replace(/\.[jt]sx?$/, "");
    let target = resolvePath(root, entry);
    return withoutExtension === target;
}

/**
 * Rewrites arrow-form component and `clientEntry()` exports to named function
 * expressions so `remix/ui-hmr` can instrument them. Returns the rewritten
 * source, or `undefined` when nothing qualified.
 *
 * Handles the two idiomatic Remix arrow forms:
 *
 * - `export const Name = clientEntry(url, (handle) => …)`
 * - `export const Name = (handle) => () => <jsx/>`
 *
 * Both become `export const Name = clientEntry(url, function Name(handle) { … })`
 * / `export const Name = function Name(handle) { … }`, which is behavior-
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
    if (body.type === "ArrowFunctionExpression" || body.type === "FunctionExpression") {
        return true;
    }
    if (body.type === "BlockStatement") {
        return body.body.some(
            statement =>
                statement.type === "ReturnStatement" &&
                (statement.argument?.type === "ArrowFunctionExpression" ||
                    statement.argument?.type === "FunctionExpression"),
        );
    }
    return false;
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
