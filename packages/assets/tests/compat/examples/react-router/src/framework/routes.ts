import type { RouteObject } from "react-router";

// Pages are discovered by the glob alone. Each route carries its portable
// source key, so the server asks the asset resolver for that module's
// observed assets; there is no second, hand-maintained asset list.
const glob = import.meta.glob("./**/page.tsx", { base: "../routes" });
const pages = Object.entries(glob).map(([key, lazy]) => {
  // extract route path
  // "./about/page.tsx" => "/about"
  const path = key.slice(1).replace(/\/page\.tsx$/g, "") || "/";
  return {
    id: key,
    path,
    lazy,
    handle: {
      source: "src/routes" + key.slice(1),
    },
  };
});

export const routes: RouteObject[] = [
  {
    id: "root",
    path: "",
    lazy: () => import("../layout"),
    handle: {
      source: "src/layout.tsx",
    },
    children: pages as any,
  },
];
