/**
 * Ambient declarations an app opts into through its tsconfig `types`.
 *
 * @module
 */

declare module "*?raw" {
    /** The file's text. */
    let text: string;
    export default text;
}

declare module "fixture:dev" {
    /** Renders nothing. */
    export const Probe: () => null;
}
