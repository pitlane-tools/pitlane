// A different module, used as the environment's build input to show the
// plugin never substitutes it for the explicit development entry.
export default {
    fetch(): Response {
        return new Response("other build input");
    },
};
