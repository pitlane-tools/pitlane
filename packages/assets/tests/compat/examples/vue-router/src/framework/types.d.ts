// https://router.vuejs.org/guide/advanced/meta.html#TypeScript
import "vue-router";

export {};

declare module "vue-router" {
  interface RouteMeta {
    /** The route component's portable source key for @pitlane/assets. */
    source?: string;
  }
}
