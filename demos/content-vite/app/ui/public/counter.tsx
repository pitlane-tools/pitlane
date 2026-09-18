import { clientEntry, on, type Handle } from "remix/ui";

/**
 * A browser component: it hydrates and keeps its own state across clicks.
 *
 * `@pitlane/dev` rewrites `import.meta.url` into the built asset's URL, which
 * is what the browser loads to hydrate this. The no-bundler demo writes the
 * asset-server path out instead: giving a browser module its URL is the host's
 * job either way, and the MDX file importing this is identical in both demos.
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
