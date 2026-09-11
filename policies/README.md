# Policies

This directory holds rules that future work must continue to enforce.

Name each file `<NNNN>-<slug>.md`, using the next four-digit number and a kebab-case slug.
Required frontmatter is `id: policy.<NNNN>`, `title`, `status`, `established-by`, and `supersedes`.
The lifecycle is `draft` → `active`; a replaced policy is `superseded`.
History is preserved: never delete a superseded entry — mark it `superseded` and link its replacement through `supersedes`.
