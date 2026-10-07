import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

export let assets = createAssetResolver(manifest);
