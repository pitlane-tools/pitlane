import { clientEntry, on, type Handle } from "remix/component";

export let CartButton = clientEntry(
    import.meta.url,
    function CartButton(handle: Handle<{ inCart: boolean; name: string }>) {
        let updating = false;

        return () => {
            let { inCart, name } = handle.props;
            return (
                <form
                    className="cart-button"
                    method="POST"
                    action="/api"
                    mix={[
                        on("submit", async (event, signal) => {
                            event.preventDefault();

                            updating = true;
                            handle.update();

                            let formData = new FormData(event.currentTarget as HTMLFormElement);
                            formData.set("redirect", "none");
                            await fetch("/api", { method: "POST", body: formData, signal });
                            if (signal.aborted) return;

                            // Re-render the enclosing frame from the server.
                            await handle.frame.reload();
                            if (signal.aborted) return;

                            updating = false;
                            handle.update();
                        }),
                    ]}
                >
                    <input type="hidden" name="name" value={name} />
                    <input type="hidden" name="action" value={inCart ? "remove" : "add"} />
                    <button type="submit" className="btn" style={{ opacity: updating ? 0.5 : 1 }}>
                        {inCart ? "Remove from Cart" : "Add to Cart"}
                    </button>
                </form>
            );
        };
    },
);
