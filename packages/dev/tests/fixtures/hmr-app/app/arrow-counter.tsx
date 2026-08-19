import { clientEntry, on } from "remix/ui";

// Arrow form: not an HMR boundary. It renders and hydrates normally, but an
// edit falls back to a server-data reload rather than a state-preserving swap.
export const ArrowCounter = clientEntry(import.meta.url, handle => {
    let count = 0;

    return () => (
        <button
            data-arrow-counter
            mix={[
                on("click", () => {
                    count++;
                    handle.update();
                }),
            ]}
        >
            Arrow label A: <span data-arrow-count>{count}</span>
        </button>
    );
});
