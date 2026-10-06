import { clientEntry, on, type Handle } from "remix/component";

/**
 * A browser component: it hydrates and keeps its own state across clicks.
 *
 * The entry id is this file's own URL on every host. Under
 * `@pitlane/vite-plugin-remix` the bundler rewrites it to a portable `file:`
 * id; with no bundler it stays the `file:` URL. Either way `render({ assets })`
 * hands it to the app's asset object, which answers with the URL the browser
 * loads. Giving a browser module its URL is the host's job.
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
