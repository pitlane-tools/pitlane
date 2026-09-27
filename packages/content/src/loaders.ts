/**
 * The two built-in loaders for collections on the filesystem: {@link glob}
 * reads every file a pattern matches as one entry, and {@link file} reads one
 * JSON or YAML file holding many entries.
 *
 * @see {@link https://pitlane.tools/guides/content | Content guide}
 *
 * @module
 */
export { file } from "./loaders/file.ts";
export { glob } from "./loaders/glob.ts";
