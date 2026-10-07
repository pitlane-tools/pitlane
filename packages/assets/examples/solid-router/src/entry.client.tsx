import { hydrate } from "@solidjs/web";

import { App } from "./app.tsx";

hydrate(() => <App />, document.getElementById("app")!);
