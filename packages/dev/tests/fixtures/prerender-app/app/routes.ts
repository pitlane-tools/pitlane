import { get, route } from "remix/routes";

// Routes live under Vite's base, the way an app deployed to a project sub-path
// declares them. With the default base this is just "/".
export let routes = route(import.meta.env.BASE_URL, {
    home: "",
    blog: get("blog"),
    // Dynamic: staticPaths() cannot know the slugs, so a prerender config has
    // to supply them.
    post: get("blog/:slug"),
    // Static, but answers with a redirect rather than a document, which is the
    // ordinary shape of a path that moved.
    legacy: get("legacy"),
});
