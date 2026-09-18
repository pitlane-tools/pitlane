import { content } from "./content-passthrough.ts";

export async function query() {
    let entries = await content.settings.getCollection();
    return entries.map(entry => ({ id: entry.id, data: entry.data, filePath: entry.filePath }));
}
