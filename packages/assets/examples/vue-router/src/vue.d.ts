// `tsc` cannot read single-file components, so it sees every `.vue` import as a component.
declare module "*.vue" {
    import type { Component } from "vue";

    let component: Component;
    export default component;
}
