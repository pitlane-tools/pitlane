/**
 * `localStorage` throws a `SecurityError` when a reader blocks site data, and
 * that must never break reading. Every other failure is a real bug and is
 * left to surface.
 */
function blocked(error: unknown): boolean {
    return error instanceof DOMException && error.name === "SecurityError";
}

export function readStorage(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch (error) {
        if (blocked(error)) return null;
        throw error;
    }
}

export function writeStorage(key: string, value: string | null): void {
    try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
    } catch (error) {
        if (
            blocked(error) ||
            (error instanceof DOMException && error.name === "QuotaExceededError")
        )
            return;
        throw error;
    }
}
