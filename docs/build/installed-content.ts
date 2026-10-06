import { createContent } from "@pitlane/content";

import { authored } from "../app/authored.ts";

/**
 * The collections the installed documentation compiles: the authored pages
 * alone. The application's `content` names the same collections, so it reads
 * them from what this declaration resolved, and never loads the API
 * reference, which nothing here asks for.
 */
export let content = createContent(() => authored);
