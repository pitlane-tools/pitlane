import { clientEntry, on, type Handle } from "remix/ui";

/**
 * A browser component: it hydrates and keeps its own state across clicks.
 *
 * The entry id is the path `remix/assets` serves this file at. With a bundler
 * `@pitlane/dev` rewrites `import.meta.url` instead; giving a browser module
 * its URL is the host's job either way, and the MDX file importing this is
 * identical in both demos.
 */
export const Counter = clientEntry(
    "/assets/app/ui/public/counter.tsx",
    function Counter(handle: Handle<{ start: number }>) {
        let count = handle.props.start;

        return () => (
            <button
                mix={[
                    on("click", () => {
                        count += 1;
                        void handle.update();
                    }),
                ]}
                type="button"
            >
                clicked {count} times
            </button>
        );
    },
);
