import { remix } from "../../../src/index.ts";
import { posts } from "./app/posts.ts";

export default {
    plugins: [
        remix({
            // The shape the guide documents: static paths come from the route
            // map, dynamic ones from wherever the data lives.
            prerender({ getStaticPaths }) {
                return [...getStaticPaths(), ...posts.map(post => `/blog/${post.slug}`)];
            },
        }),
    ],
};
