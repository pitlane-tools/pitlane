import { on, type Handle } from "remix/ui";

// Named function form: an HMR boundary. Editing this component hot-swaps in
// place while preserving the live count. No `clientEntry()` wrapper — nothing
// server-renders in SPA mode, so there is no island to hydrate.
export function FnCounter(handle: Handle) {
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
}
