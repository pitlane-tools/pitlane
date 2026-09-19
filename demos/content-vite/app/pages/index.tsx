import type { Handle } from "remix/ui";

import type { PostEntry } from "#/types.ts";

export interface IndexProps {
    posts: PostEntry[];
}

export function Index(handle: Handle<IndexProps>) {
    return () => {
        let { posts } = handle.props;

        return (
            <main>
                <h1>Content collections</h1>
                <p>
                    Both demos declare these collections with the same <code>app/content.ts</code>.
                    One is built by Vite with <code>contentLayer()</code>; the other runs with no
                    bundler at all.
                </p>

                <ul>
                    {posts.map(post => (
                        <li key={post.id}>
                            <a href={`/blog/${post.id}`}>{post.data.title}</a>
                            <p>{post.data.summary}</p>
                            <small>
                                {post.data.publishedOn.toISOString().slice(0, 10)} ·{" "}
                                {post.data.author.id}
                            </small>
                        </li>
                    ))}
                </ul>

                <p>
                    <a href="/authors">Authors</a>, loaded from a single JSON file.
                </p>
            </main>
        );
    };
}
