import { createRouter } from "remix/router";
import { describe, expect, it } from "vitest";

import { crawl } from "./crawl.ts";

function html(content: string): Response {
    return new Response(content, { headers: { "Content-Type": "text/html" } });
}

function css(content = ""): Response {
    return new Response(content, { headers: { "Content-Type": "text/css" } });
}

function js(content = ""): Response {
    return new Response(content, {
        headers: { "Content-Type": "application/javascript" },
    });
}

describe("crawl(router)", () => {
    it("visits the root path by default", async () => {
        let router = createRouter();
        router.get("/", () => html("hello"));

        let visited: [string, string, string][] = [];
        for await (let { pathname, filepath, response } of crawl(router)) {
            visited.push([pathname, filepath, await response.text()]);
        }
        expect(visited).toEqual([["/", "/index.html", "hello"]]);
    });

    it("visits custom initial paths", async () => {
        let router = createRouter();
        router.get("/a", () => html("A"));
        router.get("/b", () => html("B"));

        let visited: [string, string, string][] = [];
        for await (let { pathname, filepath, response } of crawl(router, {
            paths: ["/a", "/b"],
        })) {
            visited.push([pathname, filepath, await response.text()]);
        }
        expect(visited).toEqual([
            ["/a", "/a/index.html", "A"],
            ["/b", "/b/index.html", "B"],
        ]);
    });

    it("uses correct file paths based on content type", async () => {
        let router = createRouter();
        router.get("/", () => html("<html></html>"));
        router.get("/about", () => html("<html></html>"));
        router.get("/about/", () => html("<html></html>"));
        router.get("/style.css", () => css("body {}"));
        router.get("/app.js", () => js("console.log()"));

        let filepaths: string[] = [];
        for await (let { filepath } of crawl(router, {
            paths: ["/", "/about", "/about/", "/style.css", "/app.js"],
        })) {
            filepaths.push(filepath);
        }
        expect(filepaths).toEqual([
            "/index.html",
            "/about/index.html",
            "/about/index.html",
            "/style.css",
            "/app.js",
        ]);
    });

    it("does not follow links when spider is false", async () => {
        let router = createRouter();
        router.get("/", () => html('<a href="/about">About</a>'));
        router.get("/about", () => html("<html></html>"));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router, { spider: false })) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/"]);
    });

    it("follows links by default (spider is true)", async () => {
        let router = createRouter();
        router.get("/", () => html('<a href="/about">About</a>'));
        router.get("/about", () => html("<html></html>"));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/", "/about"]);
    });

    it("queues CSS, JS, and image assets regardless of spider mode", async () => {
        let router = createRouter();
        router.get("/", () =>
            html(`
                <link rel="stylesheet" href="/style.css">
                <script src="/app.js"></script>
                <img src="/logo.png">
            `),
        );
        router.get("/style.css", () => css("body {}"));
        router.get("/app.js", () => js());
        router.get(
            "/logo.png",
            () => new Response("", { headers: { "Content-Type": "image/png" } }),
        );

        let visited: string[] = [];
        for await (let { pathname } of crawl(router, { spider: false })) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/", "/style.css", "/app.js", "/logo.png"]);
    });

    it("skips absolute http/https URLs by default", async () => {
        let router = createRouter();
        router.get("/", () => html('<a href="https://example.com/page">External</a>'));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/"]);
    });

    it("skips protocol-relative URLs by default", async () => {
        let router = createRouter();
        router.get("/", () => html('<a href="//example.com/page">External</a>'));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/"]);
    });

    it("skips non-navigable href schemes", async () => {
        let router = createRouter();
        router.get("/", () =>
            html(`
                <a href="#section">Anchor</a>
                <a href="mailto:a@b.com">Email</a>
                <a href="tel:123">Phone</a>
                <a href="javascript:void(0)">JS</a>
                <a href="data:text/plain,hello">Data</a>
                <a href="/real">Real</a>
            `),
        );
        router.get("/real", () => html("<html></html>"));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/", "/real"]);
    });

    it('does not follow links with rel="nofollow"', async () => {
        let router = createRouter();
        router.get("/", () =>
            html('<a href="/nofollow" rel="nofollow">Skip</a><a href="/follow">Follow</a>'),
        );
        router.get("/follow", () => html("<html></html>"));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/", "/follow"]);
    });

    it("queues preload/prefetch link elements", async () => {
        let router = createRouter();
        router.get("/", () =>
            html(`
                <link rel="preload" href="/preload.css" as="style">
                <link rel="prefetch" href="/prefetch.js">
                <link rel="modulepreload" href="/module.js">
                <link rel="stylesheet" href="/real.css">
            `),
        );
        router.get("/preload.css", () => css());
        router.get("/prefetch.js", () => js());
        router.get("/module.js", () => js());
        router.get("/real.css", () => css());

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/", "/preload.css", "/prefetch.js", "/module.js", "/real.css"]);
    });

    it("resolves relative hrefs against the current page URL", async () => {
        let router = createRouter();
        router.get("/blog/", () => html('<a href="post-1">Post 1</a>'));
        router.get("/blog/post-1", () => html("<html></html>"));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router, { paths: ["/blog/"] })) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/blog/", "/blog/post-1"]);
    });

    it("throws on non-2xx responses", async () => {
        let router = createRouter();
        router.get("/", () => new Response("Not Found", { status: 404, statusText: "Not Found" }));

        let crawlAll = async () => {
            for await (let { response } of crawl(router)) {
                expect(response.ok).toBe(true);
            }
        };

        await expect(crawlAll()).rejects.toThrow("Crawl failed: 404 Not Found (/)");
    });

    it("fetches pages concurrently when concurrency > 1", async () => {
        let router = createRouter();
        let inflight = 0;
        let maxInflight = 0;
        let allStarted = Promise.withResolvers<void>();
        let a = Promise.withResolvers<Response>();
        let b = Promise.withResolvers<Response>();
        let c = Promise.withResolvers<Response>();

        function slowHtml(pending: PromiseWithResolvers<Response>): Promise<Response> {
            inflight++;
            maxInflight = Math.max(maxInflight, inflight);
            if (inflight === 3) allStarted.resolve();
            return pending.promise.finally(() => {
                inflight--;
            });
        }

        router.get("/", () => html('<a href="/a">A</a><a href="/b">B</a><a href="/c">C</a>'));
        router.get("/a", () => slowHtml(a));
        router.get("/b", () => slowHtml(b));
        router.get("/c", () => slowHtml(c));

        let visited: string[] = [];
        let consume = (async () => {
            for await (let { pathname } of crawl(router, { concurrency: 3 })) {
                visited.push(pathname);
            }
        })();

        await allStarted.promise;
        expect(
            maxInflight,
            `expected concurrent requests, got max inflight: ${maxInflight}`,
        ).toBeGreaterThan(1);
        a.resolve(html("<html></html>"));
        b.resolve(html("<html></html>"));
        c.resolve(html("<html></html>"));
        await consume;

        expect(visited.toSorted()).toEqual(["/", "/a", "/b", "/c"]);
    });

    it("does not visit the same path twice", async () => {
        let router = createRouter();
        router.get("/", () => html('<a href="/shared">Shared</a>'));
        router.get("/about", () => html('<a href="/shared">Shared</a>'));
        router.get("/shared", () => html("<html></html>"));

        let visitCount: Record<string, number> = {};
        for await (let { pathname } of crawl(router, { paths: ["/", "/about"] })) {
            visitCount[pathname] = (visitCount[pathname] ?? 0) + 1;
        }
        expect(visitCount["/shared"]).toBe(1);
    });

    it('follows same-site link[rel="alternate"]', async () => {
        let router = createRouter();
        router.get("/", () =>
            html('<link rel="alternate" type="text/markdown" href="/index.md"><h1>Home</h1>'),
        );
        router.get(
            "/index.md",
            () => new Response("# Home", { headers: { "Content-Type": "text/markdown" } }),
        );

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited.toSorted()).toEqual(["/", "/index.md"]);
    });

    it('skips cross-origin link[rel="alternate"] hrefs', async () => {
        let router = createRouter();
        router.get("/", () =>
            html(`
                <link rel="alternate" type="application/rss+xml" href="https://example.com/feed.xml">
                <link rel="alternate" type="application/rss+xml" href="//example.com/feed.xml">
            `),
        );

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/"]);
    });

    it('does not follow links on pages with <meta name="robots" content="nofollow">', async () => {
        let router = createRouter();
        router.get("/", () =>
            html(`
                <meta name="robots" content="nofollow">
                <a href="/about">About</a>
                <a href="/contact">Contact</a>
            `),
        );
        router.get("/about", () => html("<html></html>"));
        router.get("/contact", () => html("<html></html>"));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/"]);
    });

    it('does not follow links on pages with <meta name="robots" content="noindex, nofollow">', async () => {
        let router = createRouter();
        router.get("/", () =>
            html(`
                    <meta name="robots" content="noindex, nofollow">
                    <a href="/about">About</a>
                `),
        );
        router.get("/about", () => html("<html></html>"));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/"]);
    });

    it("follows links on matching pages when page-level nofollow is ignored", async () => {
        let router = createRouter();
        router.get("/v1.2.3/", () =>
            html(`
                <meta name="robots" content="noindex, nofollow">
                <a href="/v1.2.3/about">About</a>
            `),
        );
        router.get("/v1.2.3/about", () => html("<html></html>"));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router, {
            paths: ["/v1.2.3/"],
            ignorePageNofollow: pathname => pathname.startsWith("/v1.2.3/"),
        })) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/v1.2.3/", "/v1.2.3/about"]);
    });

    it("still honors page-level nofollow when ignorePageNofollow does not match", async () => {
        let router = createRouter();
        router.get("/", () =>
            html(`
                <meta name="robots" content="noindex, nofollow">
                <a href="/about">About</a>
            `),
        );
        router.get("/about", () => html("<html></html>"));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router, {
            ignorePageNofollow: pathname => pathname.startsWith("/v1.2.3/"),
        })) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/"]);
    });

    it('does not follow links on pages with <meta name="googlebot" content="nofollow">', async () => {
        let router = createRouter();
        router.get("/", () =>
            html(`
                <meta name="googlebot" content="nofollow">
                <a href="/about">About</a>
            `),
        );
        router.get("/about", () => html("<html></html>"));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/"]);
    });

    it("still follows links on pages without a meta robots nofollow directive", async () => {
        let router = createRouter();
        router.get("/", () =>
            html(`
                <meta name="robots" content="noindex">
                <a href="/about">About</a>
            `),
        );
        router.get("/about", () => html("<html></html>"));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/", "/about"]);
    });

    it("still queues assets even when meta robots nofollow prevents link following", async () => {
        let router = createRouter();
        router.get("/", () =>
            html(`
                <meta name="robots" content="nofollow">
                <link rel="stylesheet" href="/style.css">
                <a href="/about">About</a>
            `),
        );
        router.get("/style.css", () => css());
        router.get("/about", () => html("<html></html>"));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited.toSorted()).toEqual(["/", "/style.css"]);
    });

    it('does not follow link[rel="alternate nofollow"]', async () => {
        let router = createRouter();
        router.get("/", () =>
            html(`
                <link rel="alternate nofollow" type="text/markdown" href="/skip.md">
                <link rel="alternate" type="text/markdown" href="/follow.md">
            `),
        );
        router.get(
            "/skip.md",
            () => new Response("skip", { headers: { "Content-Type": "text/markdown" } }),
        );
        router.get(
            "/follow.md",
            () => new Response("follow", { headers: { "Content-Type": "text/markdown" } }),
        );

        let visited: string[] = [];
        for await (let { pathname } of crawl(router)) {
            visited.push(pathname);
        }
        expect(visited.toSorted()).toEqual(["/", "/follow.md"]);
    });

    it("does not queue assets when assets is false but still follows page links", async () => {
        let router = createRouter();
        router.get("/", () =>
            html(`
                <link rel="stylesheet" href="/style.css">
                <script src="/app.js"></script>
                <img src="/logo.png">
                <a href="/about">About</a>
            `),
        );
        router.get("/about", () => html("<html></html>"));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router, { assets: false })) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/", "/about"]);
    });

    it("fetches only explicit paths when assets and spider are false", async () => {
        let router = createRouter();
        router.get("/", () =>
            html(`
                <link rel="stylesheet" href="/style.css">
                <script src="/app.js"></script>
                <img src="/logo.png">
                <a href="/about">About</a>
            `),
        );
        router.get("/other", () => html('<a href="/another">Another</a>'));

        let visited: string[] = [];
        for await (let { pathname } of crawl(router, {
            paths: ["/", "/other"],
            assets: false,
            spider: false,
        })) {
            visited.push(pathname);
        }
        expect(visited).toEqual(["/", "/other"]);
    });

    it("leaves the yielded HTML response body readable", async () => {
        let router = createRouter();
        router.get("/", () => html("<h1>Home</h1>"));

        let body = "";
        for await (let { response } of crawl(router)) {
            body = await response.text();
        }
        expect(body).toBe("<h1>Home</h1>");
    });
});
