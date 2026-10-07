import { render } from "remix/middleware/render";
import { staticFiles } from "remix/middleware/static";
import { createRouter, type MiddlewareContext } from "remix/router";

import { assets } from "./assets.ts";
import { handleCartAction } from "./cart.ts";
import { Document } from "./document.tsx";
import { AboutPage } from "./pages/about.tsx";
import { BookCard } from "./pages/book-card.tsx";
import { BooksPage } from "./pages/books.tsx";
import { HomePage } from "./pages/home.tsx";
import { NotFoundPage } from "./pages/not-found.tsx";
import { routes } from "./routes.ts";

let renderMiddleware = render({ assets });
type AppContext = MiddlewareContext<[typeof renderMiddleware]>;

declare module "remix/router" {
    interface RouterTypes {
        context: AppContext;
    }
}

export let router = createRouter<AppContext>({
    middleware: [staticFiles("./dist/client"), renderMiddleware],
});

router.map(routes.home, ({ render }) =>
    render(
        <Document pathname="/">
            <HomePage />
        </Document>,
    ),
);

router.map(routes.about, ({ render }) =>
    render(
        <Document pathname="/about">
            <AboutPage />
        </Document>,
    ),
);

router.map(routes.books, ({ render }) =>
    render(
        <Document pathname="/books">
            <BooksPage />
        </Document>,
    ),
);

// A frame response: the card alone, without the document.
router.map(routes.bookCard, ({ render, url }) => render(<BookCard name={url.searchParams.get("name") ?? ""} />));

router.post("/api", ({ request }) => handleCartAction(request));

router.get("/*path", ({ render, url }) =>
    render(
        <Document pathname={url.pathname}>
            <NotFoundPage />
        </Document>,
        { status: 404 },
    ),
);

export default router;

if (import.meta.hot) {
    import.meta.hot.accept();
}
