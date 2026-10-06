import "@vitejs/plugin-react-swc/preamble";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { App } from "./App";

function main() {
  startTransition(() => {
    hydrateRoot(
      document.getElementById("root")!,
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}

main();
