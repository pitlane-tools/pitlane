// Must run before Lit loads, so the element adopts its server-rendered shadow
// root instead of rendering a new one.
import "@lit-labs/ssr-client/lit-element-hydrate-support.js";
import "./counter.ts";
