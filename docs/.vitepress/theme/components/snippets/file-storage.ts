// @ts-nocheck
import { env } from "cloudflare:workers";
import { R2FileStorage } from "pitlane/file-storage-r2";
import { createController } from "remix/router";

let files = new R2FileStorage(env.FILES);

export default createController(routes.avatar, {
    actions: {
        async upload({ request }) {
            await files.set(
                "avatar",
                await context.request.blob(),
            );
        },
    },
});
