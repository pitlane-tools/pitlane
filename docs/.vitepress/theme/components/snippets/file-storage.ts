// @ts-nocheck
import { env } from "cloudflare:workers";
import { R2FileStorage } from "pitlane/file-storage-r2";

let files = new R2FileStorage(env.FILES);

router.map(routes.avatar, async context => {
    await files.set(
        "avatar",
        await context.request.blob(),
    );
});
