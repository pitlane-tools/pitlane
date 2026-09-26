/**
 * The browser side of documentation search: Pagefind's engine and index
 * chunks, loaded the first time a reader searches and never while reading.
 */

const ENGINE_URL = "/pagefind/pagefind.js";
const RESULT_LIMIT = 12;

interface PagefindSubResult {
    title: string;
    url: string;
    excerpt: string;
}

interface PagefindResultData {
    url: string;
    excerpt: string;
    meta: Record<string, string | undefined>;
    sub_results: PagefindSubResult[];
}

interface PagefindEngine {
    init(): Promise<void>;
    destroy(): Promise<void>;
    debouncedSearch(
        query: string,
    ): Promise<{ results: { data(): Promise<PagefindResultData> }[] } | null>;
}

/** One search result, ready to render. */
export type SearchHit = {
    /** A canonical page, or a section anchor on one. */
    href: string;
    title: string;
    /** `Guides`, `Deploy`, or `API`. */
    section?: string;
    /** The package module a symbol belongs to. */
    module?: string;
    kind?: string;
    /** The section of the page that matched, when it is not the page itself. */
    heading?: string;
    /** Pagefind's excerpt: escaped text with `<mark>` around the matches. */
    excerpt: string;
};

export interface SearchOutcome {
    hits: SearchHit[];
    total: number;
}

let engine: Promise<PagefindEngine> | undefined;
let attempts = 0;

/** Loads and initializes the engine once; a failed load is forgotten so the next call retries. */
export function loadSearchEngine(): Promise<PagefindEngine> {
    if (engine) return engine;
    // The module map remembers a failed fetch, so a retry asks for a fresh URL.
    let url = attempts++ ? `${ENGINE_URL}?retry=${attempts}` : ENGINE_URL;
    let loading = import(/* @vite-ignore */ url).then(async (module: PagefindEngine) => {
        await module.init();
        return module;
    });
    engine = loading;
    loading.catch(() => {
        if (engine === loading) engine = undefined;
    });
    return loading;
}

/**
 * Searches the index. Resolves to `null` when a later query superseded this
 * one before it ran, which is how Pagefind's debounce reports it.
 */
export async function searchDocumentation(query: string): Promise<SearchOutcome | null> {
    let loading = loadSearchEngine();
    let pagefind = await loading;
    try {
        let found = await pagefind.debouncedSearch(query);
        if (!found) return null;
        let results = await Promise.all(
            found.results.slice(0, RESULT_LIMIT).map(result => result.data()),
        );
        let needle = query.trim().toLowerCase();
        let exact = results.filter(result => result.meta.title?.toLowerCase() === needle);
        let ordered = [...exact, ...results.filter(result => !exact.includes(result))];
        return { hits: ordered.map(result => toHit(result, needle)), total: found.results.length };
    } catch (error) {
        if (engine === loading) {
            engine = undefined;
            await pagefind.destroy();
        }
        throw error;
    }
}

/** A page whose title matches is the destination itself; otherwise its best-matching section is. */
function toHit(result: PagefindResultData, needle: string): SearchHit {
    let title = result.meta.title ?? result.url;
    let best = title.toLowerCase().includes(needle)
        ? undefined
        : (result.sub_results.find(sub => sub.url !== result.url) ?? result.sub_results[0]);
    return {
        href: best?.url ?? result.url,
        title,
        section: result.meta.section,
        module: result.meta.module,
        kind: result.meta.kind,
        heading: best && best.title !== title ? best.title : undefined,
        excerpt: best?.excerpt ?? result.excerpt,
    };
}
