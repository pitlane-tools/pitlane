import { type Cookie, createCookie } from "remix/cookie";

import {
    DEFAULT_PREFERENCES,
    type DocumentPage,
    PREFERENCE_CHOICES,
    PREFERENCE_COOKIES,
    PREFERENCE_MAX_AGE,
    type Preferences,
} from "./document.ts";

let keys = Object.keys(DEFAULT_PREFERENCES) as (keyof Preferences)[];

// Host-only (no Domain), readable by the browser's one-time migration from
// localStorage, and sent on top-level navigations from other sites so a deep
// link still renders the reader's choices.
let cookies = Object.fromEntries(
    keys.map(key => [
        key,
        createCookie(PREFERENCE_COOKIES[key], {
            encode: value => value,
            decode: value => value,
            secure: true,
            sameSite: "Lax",
            path: "/",
            maxAge: PREFERENCE_MAX_AGE,
        }),
    ]),
) as Record<keyof Preferences, Cookie>;

function isChoice<Key extends keyof Preferences>(
    key: Key,
    value: unknown,
): value is Preferences[Key] {
    return (
        typeof value === "string" && (PREFERENCE_CHOICES[key] as readonly string[]).includes(value)
    );
}

/**
 * The reader's preferences for this request: a supported value from the query
 * first, so a selection still shows when cookies are blocked, then the cookie,
 * then the default. The build mode never comes from the query; a variant is
 * chosen by its URL.
 */
export async function readPreferences(request: Request): Promise<Preferences> {
    let url = new URL(request.url);
    let header = request.headers.get("cookie");
    let preferences = { ...DEFAULT_PREFERENCES };
    await Promise.all(
        keys.map(async key => {
            let query = key === "buildMode" ? null : url.searchParams.get(key);
            let selected = isChoice(key, query) ? query : await cookies[key].parse(header);
            if (isChoice(key, selected)) Object.assign(preferences, { [key]: selected });
        }),
    );
    return preferences;
}

/**
 * Stores one preference and sends the reader back to `returnTo` with `303 See
 * Other`. Choosing the other build mode on a two-mode guide lands on its
 * counterpart; any other choice rides along in the query so the next page
 * shows it even when the cookie is refused.
 *
 * `returnTo` must be a path on this origin. Anything else, like an unknown
 * preference or an unsupported value, is a `400` that sets nothing.
 */
export async function submitPreference(
    request: Request,
    documents: ReadonlyMap<string, { page: DocumentPage }>,
): Promise<Response> {
    let form: FormData;
    try {
        form = await request.formData();
    } catch {
        return invalidPreference();
    }
    let key = form.get("preference");
    let value = form.get("value");
    let returnTo = form.get("returnTo");
    if (typeof key !== "string" || !keys.includes(key as keyof Preferences))
        return invalidPreference();
    let preference = key as keyof Preferences;
    if (!isChoice(preference, value)) return invalidPreference();

    let destination = sameOriginPath(returnTo, request.url);
    if (!destination) return invalidPreference();
    if (preference === "buildMode") {
        let page = documents.get(destination.pathname)?.page;
        if (page?.counterpart && page.buildMode !== value) destination.pathname = page.counterpart;
    } else {
        destination.searchParams.set(preference, value);
    }

    return new Response(null, {
        status: 303,
        headers: {
            location: destination.pathname + destination.search + destination.hash,
            "set-cookie": await cookies[preference].serialize(value),
        },
    });
}

/**
 * `returnTo` as a URL on the request's own origin, or nothing. The path has to
 * stay a path after normalization too: `/.//example.com` resolves to
 * `//example.com`, which a browser reads as another host.
 */
function sameOriginPath(returnTo: FormDataEntryValue | null, base: string): URL | undefined {
    if (typeof returnTo !== "string" || !returnTo.startsWith("/") || returnTo.startsWith("//"))
        return undefined;
    if (returnTo.includes("\\")) return undefined;
    let destination = new URL(returnTo, base);
    if (destination.origin !== new URL(base).origin || destination.pathname.startsWith("//"))
        return undefined;
    return destination;
}

function invalidPreference() {
    return new Response("Invalid documentation preference or return destination.", { status: 400 });
}
