// @ts-nocheck
// app/entry.server.tsx
import { createRouter } from "remix/router";

import { Document } from "./document.tsx";
import { render } from "./render.tsx";
import { routes } from "./routes.ts";

export let router = createRouter({ middleware: [render()] });
router.map(routes.home, ({ render }) => render(<Document />));

// the default export IS the fetch handler
export default router;
