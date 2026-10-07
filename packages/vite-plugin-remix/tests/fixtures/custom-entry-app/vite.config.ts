import { remix } from "../../../src/index.ts";

// A fully server-rendered app: no browser script, a server entry outside
// app/, and app/entry.server.ts left in place so dev requests prove they reach
// the configured module rather than the default path.
export default {
    plugins: [remix({ clientEntry: false, serverEntry: "server/http.ts" })],
};
