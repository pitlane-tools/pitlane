import { clientEntry, on, type Handle } from "remix/component";
import "./counter.css";

export let Counter = clientEntry(import.meta.url, function Counter(handle: Handle<{ initialCount: number }>) {
    let count = handle.props.initialCount;
    return () => (
        <div className="card counter-card">
            <p>
                Count: <span>{count}</span>
            </p>
            <button
                mix={[
                    on("click", () => {
                        count++;
                        handle.update();
                    }),
                ]}
            >
                Increment
            </button>
        </div>
    );
});
