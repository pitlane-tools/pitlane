import { clientEntry, type Handle } from "remix/ui";
import * as jsxRuntime from "remix/ui/jsx-runtime";

/** A browser component: the entry id is the URL its asset server serves. */
export const Counter = clientEntry(
    "/assets/fixtures/components/counter.tsx",
    function Counter(handle: Handle<{ start: number }>) {
        return () => jsxRuntime.jsx("button", { children: `count ${handle.props.start}` });
    },
);
