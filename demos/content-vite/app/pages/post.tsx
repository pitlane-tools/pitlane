import type { Heading, RenderedEntry } from "@pitlane/content";
import type { Handle } from "remix/ui";

import type { AuthorEntry, PostEntry } from "#/types.ts";

export interface PostPageProps {
    post: PostEntry;
    author: AuthorEntry | undefined;
    headings: Heading[];
    Content: RenderedEntry["Content"];
}

export function PostPage(handle: Handle<PostPageProps>) {
    return () => {
        let { Content, author, headings, post } = handle.props;

        return (
            <main>
                <a href="/">Back</a>
                <h1>{post.data.title}</h1>
                <p>{post.data.summary}</p>

                {author ? (
                    <p>
                        By {author.data.name}. {author.data.bio}
                    </p>
                ) : (
                    <p>Author {post.data.author.id} is not in the authors collection.</p>
                )}

                <nav>
                    <h2>On this page</h2>
                    {headings.length === 0 ? (
                        <p>No headings. A prebuilt .md entry reports none.</p>
                    ) : (
                        <ul>
                            {headings.map(heading => (
                                <li key={heading.slug}>
                                    <a href={`#${heading.slug}`}>{heading.text}</a>
                                </li>
                            ))}
                        </ul>
                    )}
                </nav>

                <article>
                    <Content />
                </article>
            </main>
        );
    };
}
