---
"@pitlane/data-table-d1": minor
---

Requires Remix 3.3. Rows now read the same as through Remix's SQLite driver: `json()` columns come back parsed, `boolean()` columns as `true` or `false`, and `timestamp()` columns as `Date` objects. A `Date` is written as UTC text in SQLite's `current_timestamp` format, including in raw `sql` statements and `batch()`, where D1 previously rejected it.

Two query builder fixes come with the SQL compiler from Remix 3.3. An upsert with a separate `update` object now writes those values into the columns it names; before, they were bound to the inserted columns. `orderBy()` now rejects a direction other than `asc` or `desc` instead of copying it into the SQL.

Code that compared these columns with `1`, `0`, or JSON text should compare with the decoded values. Code that wrote `JSON.stringify()` output to a `json()` column should pass the value itself, because Remix 3.3 encodes JSON on write.
