import { remix } from "../../../src/index.ts";

// No `server: false`: this app keeps its server, and simply never renders UI
// on it. The document is a shell, the data routes answer JSON, and the browser
// owns everything else.
export default {
    plugins: [remix()],
};
