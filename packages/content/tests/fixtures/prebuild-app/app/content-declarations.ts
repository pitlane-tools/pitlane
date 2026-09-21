/// <reference types="vite/client" />

import { createContent, type ContentLoader } from "@pitlane/content";
import * as s from "remix/data-schema";

let declarationsComplete = false;

function loader(title: string): ContentLoader {
    return {
        name: title,
        async load(context) {
            if (!declarationsComplete) throw new Error("Declarations are still being evaluated");
            if (import.meta.env.PROD) throw new Error("The source is unavailable at runtime");
            await Promise.resolve();
            context.store.set({
                id: "entry",
                data: await context.parseData({ id: "entry", data: { title } }),
            });
        },
    };
}

let first = createContent(c => ({
    first: c.collection({ loader: loader("First"), schema: s.object({ title: s.string() }) }),
}));
let second = createContent(c => ({
    second: c.collection({ loader: loader("Second"), schema: s.object({ title: s.string() }) }),
}));

declarationsComplete = true;

export async function query() {
    return {
        first: (await first.first.getEntry("entry"))?.data.title,
        second: (await second.second.getEntry("entry"))?.data.title,
    };
}
