// @ts-nocheck
// app/document.tsx — hashed asset URLs, resolved server-side
import { mergeAssets } from "@pitlane/dev/runtime";

import clientAssets from "./entry.browser.ts?assets=client";
import serverAssets from "./entry.server.tsx?assets=ssr";

let assets = mergeAssets(clientAssets, serverAssets);

export let Head = () => (
    <>
        {assets.css.map(attrs => (
            <link key={attrs.href} {...attrs} rel="stylesheet" />
        ))}
        <script async src={clientAssets.entry} type="module" />
    </>
);
