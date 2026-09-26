import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

const MANAGER = "pitlane-package-manager";
const BUILD = "pitlane-build-mode";

let loads = 0;
let browserGlobals = ["window", "document"].map(key => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
]);

afterEach(() => {
    for (let [key, descriptor] of browserGlobals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
    }
});

/**
 * The browser preference module, loaded fresh into a page whose localStorage
 * holds `storage` and whose cookie jar holds `cookies`. `blocked` makes the
 * storage refuse everything, as a reader blocking site data does, or refuse
 * only writes.
 */
async function page({ storage = {}, cookies = {}, blocked, cookiesBlocked }) {
    let items = new Map(Object.entries(storage));
    let jar = new Map(Object.entries(cookies));
    let refuse = () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
    };
    let localStorage = {
        getItem: key => items.get(key) ?? null,
        setItem(key, value) {
            if (blocked === "write") refuse();
            items.set(key, String(value));
        },
        removeItem(key) {
            if (blocked === "write") refuse();
            items.delete(key);
        },
    };
    globalThis.window = {
        get localStorage() {
            if (blocked === "all") refuse();
            return localStorage;
        },
    };
    globalThis.document = {
        get cookie() {
            if (cookiesBlocked === "read") refuse();
            return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
        },
        set cookie(serialized) {
            if (cookiesBlocked === "write") refuse();
            let [pair, ...attributes] = serialized.split(/;\s*/);
            let separator = pair.indexOf("=");
            let name = pair.slice(0, separator);
            if (attributes.some(attribute => /^max-age=0$/i.test(attribute))) jar.delete(name);
            else jar.set(name, pair.slice(separator + 1));
        },
    };
    let preferences = await import(`../app/browser/preferences.ts?page=${loads++}`);
    return { preferences, items, jar };
}

test("proposal.0004: a valid stored choice wins over a legacy cookie, which is retired", async () => {
    let { preferences, items, jar } = await page({
        storage: { [MANAGER]: "pnpm" },
        cookies: { [MANAGER]: "yarn" },
    });
    preferences.migrateLegacyCookies();
    assert.equal(preferences.rememberedPreference("packageManager"), "pnpm");
    assert.equal(items.get(MANAGER), "pnpm");
    assert.equal(jar.has(MANAGER), false);
});

test("proposal.0004: a valid legacy cookie replaces absent or invalid storage and is retired", async () => {
    let { preferences, items, jar } = await page({
        storage: { [MANAGER]: "pip" },
        cookies: { [MANAGER]: "yarn", [BUILD]: "no-build", "pitlane-appearance": "dark" },
    });
    preferences.migrateLegacyCookies();
    assert.equal(preferences.rememberedPreference("packageManager"), "yarn");
    assert.equal(preferences.rememberedPreference("buildMode"), "no-build");
    assert.equal(items.get(MANAGER), "yarn");
    assert.equal(items.get(BUILD), "no-build");
    assert.equal(jar.has(MANAGER), false);
    assert.equal(jar.has(BUILD), false);
    assert.deepEqual([...items.keys()].sort(), [BUILD, MANAGER], "appearance is not migrated");
});

test("proposal.0004: invalid stored and legacy values leave the defaults in place", async () => {
    let { preferences, items, jar } = await page({
        storage: { [BUILD]: "webpack" },
        cookies: { [MANAGER]: "pip" },
    });
    preferences.migrateLegacyCookies();
    assert.equal(preferences.rememberedPreference("packageManager"), undefined);
    assert.equal(preferences.rememberedPreference("buildMode"), undefined);
    assert.equal(items.has(MANAGER), false);
    assert.equal(jar.has(MANAGER), false);
});

test("proposal.0004: when storage refuses the migration, the cookie stays and still applies to the session", async () => {
    let { preferences, items, jar } = await page({
        cookies: { [MANAGER]: "yarn" },
        blocked: "write",
    });
    preferences.migrateLegacyCookies();
    assert.equal(preferences.rememberedPreference("packageManager"), "yarn");
    assert.equal(items.has(MANAGER), false);
    assert.equal(jar.get(MANAGER), "yarn");
});

test("proposal.0004: with storage blocked, reading works and choices last for the session", async () => {
    let { preferences, jar } = await page({ cookies: { [BUILD]: "no-build" }, blocked: "all" });
    preferences.migrateLegacyCookies();
    assert.equal(preferences.rememberedPreference("buildMode"), "no-build");
    assert.equal(jar.get(BUILD), "no-build");
    preferences.rememberPreference("packageManager", "bun");
    assert.equal(preferences.rememberedPreference("packageManager"), "bun");
});

test("proposal.0004: an explicit choice wins over a migrated one and is stored", async () => {
    let { preferences, items } = await page({ cookies: { [MANAGER]: "yarn" } });
    preferences.migrateLegacyCookies();
    preferences.rememberPreference("packageManager", "vp");
    assert.equal(preferences.rememberedPreference("packageManager"), "vp");
    assert.equal(items.get(MANAGER), "vp");
});

test("proposal.0004: unreadable cookies do not prevent stored or session choices", async () => {
    let { preferences } = await page({
        storage: { [MANAGER]: "pnpm" },
        cookiesBlocked: "read",
    });
    preferences.migrateLegacyCookies();
    assert.equal(preferences.rememberedPreference("packageManager"), "pnpm");
    preferences.rememberPreference("buildMode", "no-build");
    assert.equal(preferences.rememberedPreference("buildMode"), "no-build");
});

test("proposal.0004: refused cookie retirement preserves migrated choices", async () => {
    let { preferences, items, jar } = await page({
        cookies: { [MANAGER]: "yarn", [BUILD]: "no-build" },
        cookiesBlocked: "write",
    });
    preferences.migrateLegacyCookies();
    assert.equal(preferences.rememberedPreference("packageManager"), "yarn");
    assert.equal(preferences.rememberedPreference("buildMode"), "no-build");
    assert.equal(items.get(MANAGER), "yarn");
    assert.equal(items.get(BUILD), "no-build");
    assert.equal(jar.get(MANAGER), "yarn");
});
