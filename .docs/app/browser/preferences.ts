import { PREFERENCE_CHOICES, PREFERENCE_STORAGE_KEYS, type Preferences } from "../document.ts";
import { readStorage, writeStorage } from "./storage.ts";

type PreferenceKey = keyof Preferences;

/**
 * Choices made or recovered during this page's life. They outrank storage,
 * which may be blocked or may have refused the write.
 */
let session: { -readonly [Key in PreferenceKey]?: Preferences[Key] } = {};

/** Announces a changed choice, with the preference's key as the event type. */
let changes = new EventTarget();

function isChoice<Key extends PreferenceKey>(key: Key, value: unknown): value is Preferences[Key] {
    return (
        typeof value === "string" && (PREFERENCE_CHOICES[key] as readonly string[]).includes(value)
    );
}

/**
 * The reader's remembered choice, or nothing when they have none. Nothing on
 * the server too, so a published page never depends on a reader.
 */
export function rememberedPreference<Key extends PreferenceKey>(
    key: Key,
): Preferences[Key] | undefined {
    if (typeof window === "undefined") return undefined;
    let chosen = session[key];
    if (chosen !== undefined) return chosen;
    let stored = readStorage(PREFERENCE_STORAGE_KEYS[key]);
    return isChoice(key, stored) ? stored : undefined;
}

/** Remembers a choice the reader made and tells every subscriber on this page. */
export function rememberPreference<Key extends PreferenceKey>(
    key: Key,
    value: Preferences[Key],
): void {
    session[key] = value;
    writeStorage(PREFERENCE_STORAGE_KEYS[key], value);
    changes.dispatchEvent(new Event(key));
}

/** Calls `listener` after each new choice for `key` until `signal` aborts. */
export function onPreferenceChange(
    key: PreferenceKey,
    listener: () => void,
    signal: AbortSignal,
): void {
    changes.addEventListener(key, listener, { signal });
}

function legacyCookie(name: string): string | undefined {
    let prefix = `${name}=`;
    try {
        return document.cookie
            .split(/;\s*/)
            .find(cookie => cookie.startsWith(prefix))
            ?.slice(prefix.length);
    } catch {
        return undefined;
    }
}

/**
 * Moves each preference cookie the server-rendered reader set into storage,
 * unless storage already holds a valid choice, then retires the cookie. A
 * cookie storage cannot take stays for a later visit and applies to this
 * one. Appearance was never one of these: it follows the system.
 */
export function migrateLegacyCookies(): void {
    for (let key of Object.keys(PREFERENCE_STORAGE_KEYS) as PreferenceKey[]) migrateCookie(key);
}

function migrateCookie<Key extends PreferenceKey>(key: Key): void {
    let name = PREFERENCE_STORAGE_KEYS[key];
    let cookie = legacyCookie(name);
    if (cookie === undefined) return;
    if (isChoice(key, cookie) && !isChoice(key, readStorage(name))) {
        writeStorage(name, cookie);
        if (readStorage(name) !== cookie) {
            session[key] = cookie;
            return;
        }
    }
    try {
        document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
    } catch {
        // A retained cookie is harmless: the migrated stored choice already wins.
    }
}
