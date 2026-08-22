import { on, type Handle } from "remix/ui";

// Arrow form: normalized to a named function expression before instrumentation,
// so an edit hot-swaps in place and keeps this counter's state.
export const ArrowCounter = (handle: Handle) => {
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
};
