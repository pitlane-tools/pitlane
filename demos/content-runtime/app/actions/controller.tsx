import { createController } from "remix/router";

import { content } from "#/content.ts";
import { Document } from "#/Document.tsx";
import { Authors } from "#/pages/authors.tsx";
import { Index } from "#/pages/index.tsx";
import { PostPage } from "#/pages/post.tsx";
import { routes } from "#/routes.ts";
import { assets } from "#/utils/assets.ts";

export default createController(routes, {
    actions: {
        async assets({ request }) {
            let response = await assets.fetch(request);
            return response ?? new Response("Not found", { status: 404 });
        },

        async home({ render }) {
            let posts = await content.blog.getCollection();
            return render(
                <Document title="Content collections">
                    <Index posts={posts} />
                </Document>,
            );
        },

        async post({ params, render }) {
            let post = await content.blog.getEntry(params.slug);
            if (!post) return new Response("Not found", { status: 404 });

            let author = await content.authors.getEntry(post.data.author);
            let { Content, headings } = await post.render();

            return render(
                <Document title={post.data.title}>
                    <PostPage author={author} Content={Content} headings={headings} post={post} />
                </Document>,
            );
        },

        async authors({ render }) {
            let authors = await content.authors.getCollection();
            return render(
                <Document title="Authors">
                    <Authors authors={authors} />
                </Document>,
            );
        },
    },
});
