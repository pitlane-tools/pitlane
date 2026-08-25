import type { HTMLElement } from "./html-parser.ts";

import { parse } from "./html-parser.ts";

/**
 * Requests are dispatched straight into the router, so the origin is never
 * used for anything but satisfying the `Request` constructor.
 */
const BASE_URL = "http://localhost";

/** One fetched path and the response the router produced for it. */
export interface CrawlResult {
    /** The path that was requested, exactly as it was queued. */
    pathname: string;
    /**
     * Where the response belongs on disk. HTML lands at `<pathname>/index.html`
     * so a static host serves it for the original path; everything else keeps
     * its own path.
     */
    filepath: string;
    /** The router's response. Unconsumed: the body is still readable. */
    response: Response;
}

export interface CrawlOptions {
    /**
     * Paths to start from.
     *
     * @default ["/"]
     */
    paths?: string[];
    /**
     * Follow `<a href>` and `<link rel="alternate">` to discover more paths.
     * Turn it off to fetch exactly the paths given.
     *
     * @default true
     */
    spider?: boolean;
    /**
     * Queue the `<link href>`, `<script src>`, and `<img src>` a page
     * references. Turn it off when something else already emitted those files,
     * as a bundler does.
     *
     * @default true
     */
    assets?: boolean;
    /**
     * How many paths to fetch at once.
     *
     * @default 1
     */
    concurrency?: number;
    /**
     * Crawl a page's links even though the page asked robots not to follow
     * them. Receives the page's path.
     */
    ignorePageNofollow?: (pathname: string) => boolean;
    /**
     * Called for a path that answered with a redirect rather than a document.
     * Nothing is yielded for it: there is no page to write, and the app still
     * answers the path at runtime.
     *
     * Receives the requested path and the `Location` it pointed at, which is
     * `null` for a redirect that named none.
     */
    onRedirect?: (pathname: string, location: string | null) => void;
}

/**
 * What {@link crawl} needs from a router. A `createRouter()` router satisfies
 * it, and so does anything else that answers a `Request` — a built server
 * bundle's default export, a worker-style `{ fetch }` object, a test double.
 */
export interface CrawlTarget {
    fetch(request: Request): Response | Promise<Response>;
}

/**
 * Walks an app by dispatching requests straight into its router, yielding each
 * response as it arrives. No socket, no server, no browser: the router's
 * `fetch` is the whole transport, so this runs anywhere the app itself runs.
 *
 * Yields in completion order. Every path is fetched at most once. A redirect
 * yields nothing and reports through {@link CrawlOptions.onRedirect}; any
 * other non-2xx response aborts the crawl.
 *
 * @param router The router to crawl.
 * @param options Crawl options.
 * @returns An async iterator of results, one per fetched path.
 */
export async function* crawl(
    router: CrawlTarget,
    options: CrawlOptions = {},
): AsyncIterableIterator<CrawlResult> {
    let {
        paths = ["/"],
        spider = true,
        assets = true,
        concurrency = 1,
        ignorePageNofollow,
        onRedirect,
    } = options;

    let queue: string[] = [];
    let visited = new Set<string>();
    let results: CrawlResult[] = [];
    let active = 0;
    let error: unknown;

    // A promise the loop parks on while every worker is busy. Each completed
    // fetch swaps in a fresh one and resolves the old, waking the loop once.
    let notify: () => void = () => {};
    let gate = new Promise<void>(resolve => (notify = resolve));
    function bump() {
        let previous = notify;
        gate = new Promise<void>(resolve => (notify = resolve));
        previous();
    }

    enqueue(paths);

    while (true) {
        while (active < concurrency && queue.length > 0) {
            void fetchOne(queue.shift()!);
        }

        if (error) throw error;
        if (results.length > 0) {
            yield results.shift()!;
            continue;
        }
        if (active === 0 && queue.length === 0) break;

        await gate;
    }

    function enqueue(pathnames: string[]) {
        for (let pathname of pathnames) {
            if (visited.has(pathname)) continue;
            visited.add(pathname);
            queue.push(pathname);
        }
    }

    async function fetchOne(pathname: string) {
        active++;
        try {
            let response = await router.fetch(new Request(`${BASE_URL}${pathname}`));

            // A redirect is not a page. Failing here would make any app whose
            // "/" points at a real landing path impossible to crawl, and there
            // is nothing to write either way — the app still answers the path
            // at runtime.
            if (response.status >= 300 && response.status < 400) {
                let location = response.headers.get("Location");
                onRedirect?.(pathname, location);

                // Nobody receives this response, so its body is ours to drop.
                await response.body?.cancel();

                // Following it is the same act as following a link, so it is
                // the spider's business and not the fixed list's. Cross-origin
                // and non-navigable targets drop out in resolveAll.
                if (spider && location != null) enqueue(resolveAll([location], pathname));
                return;
            }

            if (!response.ok) {
                let status = [response.status, response.statusText].filter(Boolean).join(" ");
                throw new Error(`Crawl failed: ${status} (${pathname})`);
            }

            if (!response.headers.get("Content-Type")?.includes("text/html")) {
                results.push({ pathname, filepath: pathname, response });
                return;
            }

            // The caller gets an unread body, so parse a clone.
            let cloned = response.clone();
            results.push({
                pathname,
                filepath: pathname.replace(/\/?$/, "/index.html"),
                response,
            });

            let document = parse(await cloned.text());

            if (assets) enqueue(extractAssetPaths(document.elements, pathname));

            if (spider && (ignorePageNofollow?.(pathname) || shouldCrawlLinks(document.elements))) {
                enqueue(extractLinkPaths(document.elements, pathname));
            }
        } catch (thrown) {
            // First failure wins: later workers finishing badly should not
            // mask the error that actually started the cascade.
            error ??= thrown;
        } finally {
            active--;
            bump();
        }
    }
}

function extractAssetPaths(elements: HTMLElement[], baseUrl: string): string[] {
    let hrefs = elements
        .filter(element => element.name === "link" && !rel(element).includes("nofollow"))
        .map(element => element.getAttribute("href"));

    let sources = elements
        .filter(element => element.name === "script" || element.name === "img")
        .map(element => element.getAttribute("src"));

    return resolveAll([...hrefs, ...sources], baseUrl);
}

function extractLinkPaths(elements: HTMLElement[], baseUrl: string): string[] {
    let hrefs = elements
        .filter(
            element =>
                !rel(element).includes("nofollow") &&
                (element.name === "a" ||
                    (element.name === "link" && rel(element).includes("alternate"))),
        )
        .map(element => element.getAttribute("href"));

    return resolveAll(hrefs, baseUrl);
}

function resolveAll(hrefs: (string | null)[], baseUrl: string): string[] {
    let paths: string[] = [];

    for (let href of hrefs) {
        if (href == null || isNonNavigable(href) || !isRelativeUrl(href)) continue;
        let resolved = resolveHref(href, baseUrl);
        if (resolved != null) paths.push(resolved);
    }

    return paths;
}

/** Whether a page opted out of having its links followed. */
function shouldCrawlLinks(elements: HTMLElement[]): boolean {
    return !elements.some(element => {
        if (element.name !== "meta") return false;
        let name = element.getAttribute("name")?.toLowerCase();
        if (name !== "robots" && name !== "googlebot") return false;
        let content = element.getAttribute("content")?.toLowerCase() ?? "";
        return content.split(/[\s,]+/).includes("nofollow");
    });
}

function rel(element: HTMLElement): string[] {
    return element.getAttribute("rel")?.split(/\s+/) ?? [];
}

function isNonNavigable(href: string): boolean {
    return (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        href.startsWith("data:")
    );
}

function isRelativeUrl(href: string): boolean {
    return !href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("//");
}

function resolveHref(href: string, baseUrl: string): string | null {
    if (href.startsWith("/")) return href;

    try {
        return new URL(href, `${BASE_URL}${baseUrl}`).pathname;
    } catch {
        return null;
    }
}
