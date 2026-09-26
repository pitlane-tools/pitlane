import { get, route } from "remix/routes";

/**
 * The documentation's URL contract, one route per section. The routes build
 * every link the site publishes, so a page's address and the links to it come
 * from the same pattern.
 *
 * `other` catches what no section claims: the spellings the previous site
 * served, which redirect to their page, and everything else, which is a 404.
 * A deployment answers those from the `_redirects` file the build publishes;
 * only the development server reaches the route.
 */
export let routes = route({
    guide: get("/guides/:slug"),
    deploy: get("/deploy/:slug"),
    /** The generated reference: a module overview (`dev/`) or a symbol (`dev/function/remix`). */
    api: get("/package/*path"),
    other: get("/*path"),
});
