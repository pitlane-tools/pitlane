import { renderCode } from "../../build/expressive-code.ts";
import { routes } from "../routes.ts";

let sources = [
    {
        id: "dev",
        name: "@pitlane/vite-plugin-remix",
        purpose: "Build & develop",
        file: "vite.config.ts",
        guide: "vite-plugin",
        description: "Development, server, and browser builds, all in one Vite plugin.",
        code: `import { remix } from "pitlane/vite-plugin-remix";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [remix()],
});`,
    },
    {
        id: "content",
        name: "@pitlane/content",
        purpose: "Load & validate",
        file: "app/content.ts",
        guide: "content",
        description: "Your files become typed, queryable collections.",
        code: `import { createContent } from "pitlane/content";
import * as loaders from "pitlane/content/loaders";
import * as s from "remix/data-schema";

export let content = createContent(c => ({
    posts: c.collection({
        loader: loaders.glob({
            base: "app/posts",
            pattern: "**/*.md",
        }),
        schema: s.object({ title: s.string() }),
    }),
}));`,
    },
    {
        id: "theme",
        name: "@pitlane/theme",
        purpose: "Style & compose",
        file: "app/theme.ts",
        guide: "theme",
        description: "Typed design tokens. Native Remix styling.",
        code: `import { createTheme } from "pitlane/theme";
import * as s from "pitlane/theme/schema";

export let { token: t, Theme } = createTheme({
    schema: {
        color: s.color(),
        spacing: s.scale(),
    },
    tokens: {
        color: { brand: "#eb2027" },
        spacing: "0.25rem",
    },
});`,
    },
    {
        id: "crawler",
        name: "@pitlane/crawler",
        purpose: "Crawl & prerender",
        file: "scripts/crawl.ts",
        guide: "crawler",
        description: "Follow your app’s links without starting an HTTP server.",
        code: `import { crawl } from "pitlane/crawler";
import router from "../app/entry.server.ts";

for await (let { pathname, response } of crawl(router)) {
    console.log(pathname, response.status);
}`,
    },
    {
        id: "d1",
        name: "@pitlane/data-table-d1",
        purpose: "Connect your data",
        file: "app/database.ts",
        guide: "cloudflare-d1",
        description: "Remix’s database API, backed by your Cloudflare D1 binding.",
        code: `import { createD1Database } from "pitlane/data-table-d1";
import { env } from "cloudflare:workers";

export let db = createD1Database(env.DB);`,
    },
];

export let examples = await Promise.all(
    sources.map(async source => ({
        ...source,
        href: routes.guide.href({ slug: source.guide }),
        html: await renderCode(
            source.code,
            "ts",
            `Homepage ${source.name}`,
            `title="${source.file}"`,
        ),
    })),
);
