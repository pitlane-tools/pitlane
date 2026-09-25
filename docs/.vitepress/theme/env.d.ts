declare module "*.vue" {
    import type { DefineComponent } from "vue";

    let component: DefineComponent<object, object, unknown>;
    export default component;
}

declare module "*.css";

declare module "virtual:group-icons.css";

/// <reference types="vite/client" />
