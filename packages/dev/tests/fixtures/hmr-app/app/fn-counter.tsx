import { clientEntry, on } from "remix/ui";

// Named function form: an HMR boundary. Editing this component hot-swaps in
// place while preserving the live count.
export const FnCounter = clientEntry(import.meta.url, function FnCounter(handle) {
    let count = 0;

    return () => (
        <button
            data-fn-counter
            mix={[
                on("click", () => {
                    count++;
                    handle.update();
                }),
            ]}
        >
            Fn label A: <span data-fn-count>{count}</span>
        </button>
    );
});
