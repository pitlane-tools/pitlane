import { form, get, post, route } from "remix/routes";
import { describe, expect, it } from "vitest";

import { staticPaths } from "./static-paths";

describe("staticPaths", () => {
    it("returns every static string route in sorted order", () => {
        let routes = route({
            contact: "/contact",
            home: "/",
            about: "/about",
        });

        expect(staticPaths(routes)).toEqual(["/", "/about", "/contact"]);
    });

    it("excludes routes with variables", () => {
        let routes = route({
            post: get("/blog/:slug"),
        });

        expect(staticPaths(routes)).toEqual([]);
    });

    it("excludes routes with wildcards", () => {
        let routes = route({
            files: get("/files/*rest"),
        });

        expect(staticPaths(routes)).toEqual([]);
    });

    it("recurses into nested route maps", () => {
        let routes = route({
            home: "/",
            marketing: route({
                docs: "/docs",
                pricing: "/pricing",
            }),
        });

        expect(staticPaths(routes)).toEqual(["/", "/docs", "/pricing"]);
    });

    it("includes a form path once", () => {
        let routes = route({
            guestBook: form("/guest-book"),
        });

        expect(staticPaths(routes)).toEqual(["/guest-book"]);
    });

    it("excludes post-only routes", () => {
        let routes = route({
            feedback: post("/feedback"),
        });

        expect(staticPaths(routes)).toEqual([]);
    });

    it("deduplicates paths resolved by different route names", () => {
        let routes = route({
            primaryAbout: "/about",
            secondaryAbout: "/about",
        });

        expect(staticPaths(routes)).toEqual(["/about"]);
    });

    it("returns the same explicitly sorted paths on repeated calls", () => {
        let routes = route({
            zebra: "/zebra",
            alpha: "/alpha",
            middle: "/middle",
        });
        let expected = ["/alpha", "/middle", "/zebra"];

        expect(staticPaths(routes)).toEqual(expected);
        expect(staticPaths(routes)).toEqual(expected);
    });

    it("returns no paths for an empty route map", () => {
        expect(staticPaths(route({}))).toEqual([]);
    });

    it("excludes routes constrained to a protocol and hostname", () => {
        let routes = route({
            about: "https://example.com/about",
        });

        expect(routes.about.href()).toBe("https://example.com/about");
        expect(staticPaths(routes)).toEqual([]);
    });
});
