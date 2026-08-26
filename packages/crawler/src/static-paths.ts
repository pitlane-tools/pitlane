import type { RouteMap } from "remix/routes";

import { getRoutePatternCaptures } from "remix/route-pattern";

/**
 * The shape of a `Route` this module needs. Detected structurally rather than
 * with `instanceof`: the route map being inspected usually comes from the
 * application's own `remix` copy, which is not guaranteed to be the same copy
 * this package resolved.
 */
interface RouteLike {
    method: string;
    pattern: Parameters<typeof getRoutePatternCaptures>[0];
    href(...args: never[]): string;
}

function isRoute(value: unknown): value is RouteLike {
    return (
        typeof value === "object" &&
        value !== null &&
        "method" in value &&
        "pattern" in value &&
        typeof (value as RouteLike).href === "function"
    );
}

/**
 * Collects every path in a route map that can be requested without params:
 * the Remix 3 answer to "what pages does this app have", and the input a
 * prerender pass needs before it knows any dynamic values.
 *
 * A route qualifies when it answers `GET` (or any method) and its pattern
 * declares no variables or wildcards. `/blog` is a static path; `/blog/:slug`
 * is not, because its values live outside the route map. Routes constrained to
 * a protocol or hostname are skipped too, since their href is not a path.
 *
 * Results are deduplicated and sorted, so a build that prerenders them lists
 * its output the same way every time.
 *
 * @param routes The route map, usually the one the app's router is built from.
 * @returns The static paths, sorted.
 */
export function staticPaths(routes: RouteMap): string[] {
    let paths = new Set<string>();
    collect(routes, paths);
    return [...paths].sort();
}

function collect(node: RouteMap, paths: Set<string>): void {
    for (let value of Object.values(node)) {
        if (isRoute(value)) {
            if (value.method !== "GET" && value.method !== "ANY") continue;
            if (getRoutePatternCaptures(value.pattern).length > 0) continue;

            let href = value.href();
            if (href.startsWith("/")) paths.add(href);
            continue;
        }

        if (typeof value === "object" && value !== null) collect(value as RouteMap, paths);
    }
}
