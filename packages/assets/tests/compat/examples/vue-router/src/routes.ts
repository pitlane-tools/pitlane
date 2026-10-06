import type { RouteRecordRaw } from "vue-router";

// custom framework may employ fs router convention to reduce boilerplace.
// `meta.source` is each route component's portable source key; the server
// observes its assets through the resolver.
export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "app",
    component: () => import("./app.vue"),
    meta: {
      source: "src/app.vue",
    },
    children: [
      {
        path: "/",
        name: "home",
        component: () => import("./pages/index.vue"),
        meta: {
          source: "src/pages/index.vue",
        },
      },
      {
        path: "/about",
        name: "about",
        component: () => import("./pages/about.ts"),
        meta: {
          source: "src/pages/about.ts",
        },
      },
      {
        path: "/:catchAll(.*)",
        name: "not-found",
        component: () => import("./pages/not-found.vue"),
        meta: {
          source: "src/pages/not-found.vue",
        },
      },
    ],
  },
];
