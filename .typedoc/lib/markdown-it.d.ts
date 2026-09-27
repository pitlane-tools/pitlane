// markdown-it ships no type declarations and this package does not depend on
// @types/markdown-it; this is the part of its API the legacy anchor pass uses.
declare module "markdown-it" {
    export interface Token {
        type: string;
        content: string;
        children: Token[] | null;
    }

    export default class MarkdownIt {
        constructor(options?: { html?: boolean });
        parse(source: string, env: object): Token[];
    }
}
