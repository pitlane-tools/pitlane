export { Widget } from "./widget.ts";
export type { FileEvent } from "./hot.ts";

/** Builds references to entries. */
export interface ContentBuilder {
    /** Points at an entry of `collection`. */
    reference(collection: string): Reference;
    links?: Array<{ href: string; label?: string }>;
}

/** A resolved pointer from one entry to another. */
export interface Reference {
    collection: string;
    id: string;
}

/** Renders a value as text. */
export function render(value: string): string;
/** Renders a number as text. */
export function render(value: number): string;
export function render(value: string | number): string {
    return String(value);
}

/** Builds a value with a content builder. */
export function define<T>(build: (c: ContentBuilder) => T): T {
    return build({ reference: collection => ({ collection, id: "" }) });
}

type Wide = "inherit" | "initial";

// A pass-through base whose members a page may summarize rather than list.
type Passthrough = Omit<{ display?: string; position?: string; gap?: string }, "gap">;

interface Mapped {
    /** Spacing between children. */
    gap?: number | Wide;
}

/** A style object: mapped properties plus every pass-through one. */
export interface Styles extends Passthrough, Mapped {}
