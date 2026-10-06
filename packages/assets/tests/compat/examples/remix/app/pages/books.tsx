import { Frame } from "remix/component";

const books = ["The Great Gatsby", "To Kill a Mockingbird"];

// Each card is a frame the server resolves through its own route, and the
// cart island inside it reloads only that frame.
export function BooksPage() {
    return () => (
        <main>
            {books.map(name => (
                <Frame key={name} src={`/frames/book-card?name=${encodeURIComponent(name)}`} />
            ))}
        </main>
    );
}
