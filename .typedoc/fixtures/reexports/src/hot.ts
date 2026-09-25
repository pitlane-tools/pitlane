/** A hot-reload handle; unrelated to the root module's `Reference`. */
export interface Reference {
    url: string;
}

/** A file change the watcher observed; defined here, re-exported by the root. */
export interface FileEvent {
    path: string;
}
