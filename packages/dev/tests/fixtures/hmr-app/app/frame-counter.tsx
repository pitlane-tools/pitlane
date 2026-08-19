import { acceptServerUpdates } from "@pitlane/dev/runtime";
import { clientEntry, on, type Handle } from "remix/ui";

// Drives server-data revalidation through this component's top frame instead of
// the injected navigation fallback, which the fixture's client entry suppresses.
export const FrameCounter = clientEntry(import.meta.url, function FrameCounter(handle: Handle) {
    let count = 0;

    acceptServerUpdates(handle);

    return () => (
        <button
            data-frame-counter
            mix={[
                on("click", () => {
                    count++;
                    handle.update();
                }),
            ]}
        >
            Frame label A: <span data-frame-count>{count}</span>
        </button>
    );
});
