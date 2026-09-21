import { get, route } from "remix/routes";

export let routes = route({
    assets: "/assets/*path",
    home: get("/"),
    post: get("/blog/:slug"),
    authors: get("/authors"),
});
