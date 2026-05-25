// @ts-nocheck
import { createController } from "remix/router";

import { content } from "./content.ts";

export default createController(routes.blog, {
    actions: {
        async show({ params, render }) {
            let posts =
                await content.blog.getCollection();
            let post = await content.blog.getEntry(
                params.slug,
            );
            if (!post)
                return await render(<NotFound />, {
                    status: 404,
                });

            let { Content, headings } =
                await post.render();
            let author =
                await content.authors.getEntry(
                    post.data.author,
                );

            return await render(
                <>
                    <h1>{post.data.title}</h1>
                    <h2>{post.data.dek}</h2>
                    <p>by {author.data.name}</p>
                    <main>
                        <Content />
                    </main>
                    <aside>
                        <ul>
                            {headings.map(heading => (
                                <li>{heading.text}</li>
                            ))}
                        </ul>
                    </aside>
                </>,
            );
        },
    },
});
