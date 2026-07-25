import { clientEntry, on } from "remix/ui";

export const Counter = clientEntry(import.meta.url, handle => {
    let count = 0;

    return () => (
        <button
            mix={[
                on("click", () => {
                    count++;
                    handle.update();
                }),
            ]}
        >
            Count: <span data-count>{count}</span>
        </button>
    );
});
