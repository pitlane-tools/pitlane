import { type DocumentPage, markdownPath } from "../app/document.ts";
import { htmlToMarkdown } from "./markdown.ts";

/** A page with the Markdown its rendered article means. */
export interface Exported {
    page: DocumentPage;
    markdown: string;
}

const SECTIONS: { section: DocumentPage["section"]; title: string }[] = [
    { section: "guides", title: "Guides" },
    { section: "deploy", title: "Deployment" },
    { section: "api", title: "Packages" },
];

/** The Markdown counterpart of one page: its metadata, then its article. */
export function markdownExport(page: DocumentPage, article: string): string {
    return `---\ntitle: ${JSON.stringify(page.title)}\ndescription: ${JSON.stringify(page.description)}\n---\n\n${htmlToMarkdown(article)}`;
}

/** The `llms.txt` index: every page's Markdown counterpart, grouped by section. */
export function llmsIndex(
    site: { url: string; name: string; description: string },
    exported: Exported[],
): string {
    let sections = SECTIONS.map(({ section, title }) => {
        let pages = exported.filter(({ page }) => page.section === section);
        if (pages.length === 0) return "";
        let lines = pages.map(
            ({ page }) =>
                `- [${page.title}](${site.url}${markdownPath(page.url)}): ${page.description}`,
        );
        return `## ${title}\n\n${lines.join("\n")}`;
    });
    return `# ${site.name}\n\n> ${site.description}\n\n${sections.filter(Boolean).join("\n\n")}\n`;
}

/** The whole corpus in one file, page after page. */
export function llmsFull(exported: Exported[]): string {
    return exported.map(({ markdown }) => markdown.trimEnd()).join("\n\n---\n\n") + "\n";
}

/** The sitemap of every public URL, the home page first. */
export function sitemap(siteUrl: string, urls: string[]): string {
    let entries = ["/", ...urls].map(
        url => `    <url>\n        <loc>${siteUrl}${url}</loc>\n    </url>`,
    );
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
}
