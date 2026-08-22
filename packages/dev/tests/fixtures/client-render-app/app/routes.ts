import { get, route } from "remix/routes";

export let routes = route({
    home: get("/"),
    post: get("/posts/:id"),
    posts: get("/api/posts"),
});
