import { content } from "./content.ts";

export async function query() {
    let posts = await content.blog.getCollection();
    let author = await content.authors.getEntry(posts[0].data.author);
    let ticker = await content.ticker.getCollection();
    let { headings } = await posts[1].render();
    return {
        ids: posts.map(post => post.id),
        publishedOnIsDate: posts[0].data.publishedOn instanceof Date,
        publishedOn: posts[0].data.publishedOn,
        authorName: author?.data.name,
        tickerIds: ticker.map(entry => entry.id),
        headings,
    };
}
