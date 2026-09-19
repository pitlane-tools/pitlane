import { clientEntry, on, type Handle } from "remix/ui";

/**
 * A browser component: it hydrates and keeps its own state across clicks.
 *
 * The entry id is this file's own URL on every host. Under `@pitlane/dev` the
 * bundler rewrites it to the built asset; with no bundler `render({ assets })`
 * hands the `file:` URL to the asset server, which answers with the URL the
 * browser loads. Giving a browser module its URL is the host's job either way.
 */
export const Counter = clientEntry(
    import.meta.url,
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
