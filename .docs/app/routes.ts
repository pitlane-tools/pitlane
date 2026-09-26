import { get, route } from "remix/routes";

/**
 * The documentation's URL contract. Documents are addressed by their content
 * rather than by a fixed pattern, so one route answers every document path and
 * the controller decides whether it is a page, a redirect to one, or a 404.
 */
export let routes = route({
    document: get("/*path"),
});
