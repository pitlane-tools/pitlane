import type { Handle } from "remix/ui";

import type { AuthorEntry } from "#/types.ts";

export interface AuthorsProps {
    authors: AuthorEntry[];
}

export function Authors(handle: Handle<AuthorsProps>) {
    return () => (
        <main>
            <a href="/">Back</a>
            <h1>Authors</h1>
            <dl>
                {handle.props.authors.map(author => [
                    <dt key={`${author.id}-name`}>{author.data.name}</dt>,
                    <dd key={`${author.id}-bio`}>{author.data.bio}</dd>,
                ])}
            </dl>
        </main>
    );
}
