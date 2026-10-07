import type { ScriptEntry } from "@pitlane/assets";

import { assets } from "../assets.ts";

// Defining the elements here lets the server render them into declarative
// shadow roots wherever a page uses their tags.
import "../islands/counter.ts";
import "../islands/greeting.ts";

// Each island's browser entry, by tag name. A string-literal `getScriptEntry`
// call on the resolver is what registers the module as a browser entry, so the
// keys are spelled out here rather than derived from the tag names.
export let islands: Record<string, ScriptEntry> = {
    "lit-counter": await assets.getScriptEntry("src/islands/counter.client.ts"),
    "lit-greeting": await assets.getScriptEntry("src/islands/greeting.client.ts"),
};
