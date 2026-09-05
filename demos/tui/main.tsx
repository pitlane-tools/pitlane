import { createRoot } from "@pitlane/tui/node";

import { App } from "./app.tsx";

let terminal = await createRoot();
try {
    terminal.render(<App terminal={terminal} />);
    await terminal.closed;
} finally {
    terminal.unmount();
}
