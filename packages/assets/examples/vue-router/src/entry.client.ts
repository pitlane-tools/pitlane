import { createSSRApp, vaporInteropPlugin } from "vue";
import { RouterView, createRouter, createWebHistory } from "vue-router";

import { routes } from "./routes.ts";

// The shell and Vue Router's components are VDOM; the interop plugin lets them
// render and hydrate the Vapor pages.
let app = createSSRApp(RouterView).use(vaporInteropPlugin);
let router = createRouter({ history: createWebHistory(), routes });
app.use(router);

// Hydration needs the matched route's lazy page loaded first.
await router.isReady();
app.mount("#root");
