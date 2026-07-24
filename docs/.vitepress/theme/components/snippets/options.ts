// @ts-nocheck
// every option has a sensible default; most projects pass none
remix({
    clientEntry: "app/entry.browser", // false = no client build
    serverEntry: "app/entry.server",
    serverEnvironments: ["ssr"],
    serverHandler: true, // false when a platform plugin owns dev
});
