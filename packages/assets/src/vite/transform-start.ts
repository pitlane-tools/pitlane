import { AsyncLocalStorage } from "node:async_hooks";

// Hard invalidations and transform requests share one timeline. A request
// that started before an invalidation of its module may have loaded the code
// that invalidation superseded. Vite's `transformRequest` makes the same
// judgment when it decides whether to cache a result, and the timeline counts
// the same invalidations, so that every transform Vite caches has its edges
// recorded. That leaves out HMR invalidations: an edit reaches the module
// graph first as an ordinary invalidation, and its HMR update invalidates the
// module again after a transform of the edited code may have started.
let invalidations = 0;
let requestStart = new AsyncLocalStorage<number>();

/** Counts a hard invalidation and returns its place on the timeline. */
export function countInvalidation(): number {
    return ++invalidations;
}

/** Runs `request`, which loads and transforms a module, as starting now. */
export function startRequest<T>(request: () => T): T {
    return requestStart.run(invalidations, request);
}

/**
 * The place on the timeline where the calling transform's request started.
 * A transform no request started, such as one a plugin runs through
 * `pluginContainer.transform` itself, started where this is called.
 */
export function requestStarted(): number {
    return requestStart.getStore() ?? invalidations;
}
