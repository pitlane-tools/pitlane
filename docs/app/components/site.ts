export const SITE_URL = "https://pitlane.tools";
export const SITE_NAME = "Pitlane";
export const SITE_DESCRIPTION = "Portable platform integration for Remix 3.";
export const OG_IMAGE = `${SITE_URL}/media/pitlane-lockup.png`;

/** The browser tab and social titles of a page. */
export function documentTitle(title: string): string {
    return `${title} | ${SITE_NAME}`;
}
