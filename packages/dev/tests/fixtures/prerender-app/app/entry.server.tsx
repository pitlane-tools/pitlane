import { createRouter, type MiddlewareContext } from "remix/router";

import { Document } from "./document.tsx";
import { posts } from "./posts.ts";
import { render, type RenderMiddleware } from "./render.tsx";
import { routes } from "./routes.ts";

type AppContext = MiddlewareContext<[RenderMiddleware]>;

declare module "remix/router" {
    interface RouterTypes {
        context: AppContext;
    }
}

export let router = createRouter<AppContext>({
    middleware: [render()],
});

router.map(routes.home, ({ render }) =>
    render(
        <Document title="Home">
            <a href={routes.blog.href()}>Blog</a>
        </Document>,
    ),
);

router.map(routes.blog, ({ render }) =>
    render(
        <Document title="Blog">
            <ul>
                {posts.map(post => (
                    <li key={post.slug}>
                        <a href={routes.post.href({ slug: post.slug })}>{post.title}</a>
                    </li>
                ))}
            </ul>
        </Document>,
    ),
);

router.map(routes.post, ({ render, params }) => {
    let post = posts.find(candidate => candidate.slug === params.slug);
    if (!post) return new Response("Not Found", { status: 404 });
    return render(
        <Document title={post.title}>
            <p data-slug={post.slug}>{post.title}</p>
        </Document>,
    );
});

router.map(
    routes.legacy,
    () => new Response(null, { status: 302, headers: { Location: routes.blog.href() } }),
);

// Prerendering reads this to answer `getStaticPaths()`.
export { routes };

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
