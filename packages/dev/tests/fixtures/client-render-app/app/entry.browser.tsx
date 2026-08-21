import { createRoot } from "remix/ui";

import { App } from "./app.tsx";

let container = document.getElementById("app");
if (!container) throw new Error("client-render fixture is missing its #app container");

createRoot(container).render(<App />);
