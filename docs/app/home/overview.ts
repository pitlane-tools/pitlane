/** What the home page says Pitlane is, as its description. */
export const description =
    "Pitlane gives you composable packages to help you put your Remix app on the grid.";

/** The deployment targets the home page offers, each with its guide's slug and runtime. */
export let platforms = [
    { name: "Cloudflare", slug: "cloudflare", detail: "workerd" },
    { name: "Netlify", slug: "netlify", detail: "Node.js" },
    { name: "Vercel", slug: "vercel", detail: "Node.js" },
    { name: "Railway", slug: "railway", detail: "Node.js, Bun, or Deno" },
    { name: "Deno Deploy", slug: "deno-deploy", detail: "Deno" },
    { name: "GitHub Pages", slug: "github-pages", detail: "Browser" },
];
