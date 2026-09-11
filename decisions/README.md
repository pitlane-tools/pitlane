# Decisions

This directory holds architectural choices and the context that produced them.

Name each file `<NNNN>-<slug>.md`, using the next four-digit number and a kebab-case slug.
Required frontmatter is `id: decision.<NNNN>`, `title`, `status`, `established-by`, and `supersedes`.
The lifecycle is `proposed` → `accepted`; a replaced decision is `superseded`.
History is preserved: never delete a superseded entry — mark it `superseded` and link its replacement through `supersedes`.
