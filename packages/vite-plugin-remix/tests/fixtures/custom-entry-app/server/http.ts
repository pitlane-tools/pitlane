import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

let assets = createAssetResolver(manifest);

// A stylesheet with no browser script: the app has `clientEntry: false`, so
// nothing hydrates, yet the stylesheet still needs a served URL.
let stylesheet = await assets.getHref("app/styles.css");

export default {
    fetch(request: Request) {
        let { pathname } = new URL(request.url);
        if (pathname === "/stylesheet") return new Response(stylesheet);
        return new Response(`custom entry ${pathname}`);
    },
};
