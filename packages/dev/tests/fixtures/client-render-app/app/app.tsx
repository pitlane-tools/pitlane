import type { Handle } from "remix/ui";

import type { Post } from "./posts.ts";

export function App(handle: Handle) {
    let posts: Post[] = [];

    void fetch("/api/posts")
        .then(response => response.json() as Promise<Post[]>)
        .then(loaded => {
            posts = loaded;
            handle.update();
        });

    return () => (
        <ul data-posts>
            {posts.map(post => (
                <li data-slug={post.id} key={post.id}>
                    {post.title}
                </li>
            ))}
        </ul>
    );
}
