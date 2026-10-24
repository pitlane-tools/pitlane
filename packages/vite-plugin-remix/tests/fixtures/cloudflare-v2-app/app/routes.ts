import { route } from "remix/routes";

export let routes = route({
    home: "/",
    page: "/page",
    pageWithSlash: "/page/",
    live: "/live/:slug",
});
