// @ts-nocheck
// app/counter.tsx — rewritten at build into a hydratable island
import { clientEntry, on } from "remix/ui";

export const Counter = clientEntry(import.meta.url, handle => {
    let count = 0;
    return () => (
        <button mix={[on("click", () => { count++; handle.update(); })]}>
            Count: <span>{count}</span>
        </button>
    );
});
