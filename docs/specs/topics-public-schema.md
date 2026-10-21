# Public Topic Schema (impresso-schemas submodule)

Status: draft (2026-10-21). Planning only. No changes made to the submodule or
to the generated types.

Companion to [upgrade-topics.md](./upgrade-topics.md). That spec covers the
internal pipeline (Solr, cache, services). This spec covers the **public
contract**: the `Topic` schema that lives in the `impresso-schemas` submodule
and generates the `Topic` interface in `src/models/generated/app/entities.d.ts`.

## Goal

Expose the topic-labels v3 fields and the topic description and metadata in
the public `Topic` schema, so the API response can carry them.

## How the contract is wired

```
impresso-schemas/json/impresso-2/public-api/entities/Topic.json   (source of truth, submodule)
        │  symlink
        ▼
src/schema/app/entities/  ->  impresso-schemas/json/impresso-2/public-api/entities
        │  npm run generate-types  (json-schema-to-typescript)
        ▼
src/models/generated/app/entities.d.ts  (Topic, TopicWord)
        │
        ▼
src/transformers/topic.ts  (whitelists the public output)
```

- `src/schema/app/entities` is a **symlink** into the submodule, so there is no
  copy step. A local edit to `Topic.json` is picked up by
  `npm run generate-types` immediately.
- `src/transformers/topic.ts` is the only place that decides what leaves the
  API. A property in the schema is not returned until the transformer maps it.

## Current public `Topic` schema

File: `json/impresso-2/public-api/entities/Topic.json` (submodule commit
`f3bf9b5`, detached HEAD in the local checkout).

- `additionalProperties: false`, `required: ["id", "language"]`.
- Properties: `id`, `language`, `contentItemsCount`, `words` (array of
  `TopicWord`), `model`.
- No `$id`. Other public-api entities follow the same pattern.

The v3 fields and the descriptions are absent, so the public contract does not
describe them yet.

## Scope

Add these optional properties to `Topic.json` (all absent on pre-v3 topics):

| Property | Type | Source field | Description to use (from the Solr schema comment) |
| --- | --- | --- | --- |
| `topicNumber` / `topic_number` | integer | `tp_nb_i` | Topic number within its model |
| `description` | string | `tp_desc_s` | Optional topic description |
| `metadata` | string | `tp_meta_s` | Optional topic metadata |
| `category` | string | `topic_type_s` | Topic category assigned by the label-generation model |
| `shortLabel` / `short_label` | string | `label_short_s` | Short human-readable topic label |
| `longLabel` / `long_label` | string | `label_long_txt_en` | Long-form English topic label |
| `confidence` | string, enum `high`, `medium`, `low` | `confidence_s` | Confidence level of the generated label |
| `representativeTerms` / `representative_terms` | array of string | `representative_terms_ss` | Representative terms backing the generated label |
| `generatedBy` / `generated_by` | string | `generated_by_s` | Attribution for the label-generation process |

Every property needs a `description` (SCHEMA_CONVENTIONS.md §7). Use the
Solr schema comment as the base, rewritten for a public reader, and say
"absent when the topic has no generated label" for the v3 fields.

`topic_suggest` is not exposed. It is only used by the `q` search, which is
out of scope for this change.

Not in scope: changing `TopicWord.json`, or adding a new endpoint or
parameter.

## Open decisions

### D1. Property naming convention (blocking)

The submodule's `SCHEMA_CONVENTIONS.md` §2 requires `snake_case` and forbids
camelCase. The existing `Topic.json` uses `contentItemsCount` (camelCase), and
the other public entities in the same directory should be checked before
deciding.

- **A. snake_case** (`short_label`, `topic_number`). Matches the written
  convention. The public `Topic` would then mix `contentItemsCount` with
  `short_label` unless that property is renamed too (breaking for clients).
- **B. camelCase** (`shortLabel`). Matches the existing public `Topic` and the
  names approved in the internal spec. Goes against the written convention, so
  a reviewer in the submodule may ask for a change.
- **C. Keep the existing public style and document the exception** in
  `SCHEMA_CONVENTIONS.md` for public-api entities.

Decide before editing. The internal spec's mapping table assumes B.

### D2. Base branch for the submodule PR

- The submodule's `.gitmodules` tracks `86-iml-provenance-tag`. The current
  commit (`f3bf9b5`) is on that branch, and on
  `origin/86-organize-json-schemas-by-data-phase` and others.
- `origin/master` is at `329323c` and has moved on.

Decide whether the PR targets `master` or `86-iml-provenance-tag`. Then the
change needs a branch from that base, not from the detached HEAD.

### D3. Submodule pointer in this repo

After the submodule PR is merged, the parent repo must commit the new
submodule SHA. Until then, the local checkout and CI can disagree. Decide who
updates the pointer and in which PR (this one, or a separate one first).

### D4. Shape of optional properties

The Solr schema comments say "absent on pre-v3 documents". The
`SCHEMA_CONVENTIONS.md` §6.4 prefers `["string", "null"]` over an optional
property for "unknown".

- Proposal: keep the v3 properties **optional (absent)**, not nullable. Absent
  means "no generated label", which is the Solr meaning. Nullable would add
  `null` values to every pre-v3 topic response.

Confirm.

## Process

1. Decide D1 to D4.
2. In the submodule, create a branch from the base chosen in D2.
3. Edit `json/impresso-2/public-api/entities/Topic.json`. Add `$id`/examples only
   if the directory convention requires them.
4. Add or update an example under `examples/impresso-2/public-api/entities/`
   (if the directory is used for public entities; verify first).
5. Validate: `make tests-imp2` (pytest) and `prettier --check` on the changed
   JSON (`.prettierrc`).
6. Commit with a message in the submodule's style, then push and open the PR
   (`gh` is not installed locally; install it or push from another machine).
7. After merge, update the submodule pointer in this repo, then run
   `npm run generate-types`.
8. Continue with the internal spec (`upgrade-topics.md`), mapping the new
   `Topic` properties in `src/transformers/topic.ts`.

## Verification

- `Topic.json` validates against the draft 2019-09 metaschema.
- `npm run generate-types` produces the new properties in
  `src/models/generated/app/entities.d.ts`, with no other diff.
- `npm run lint` and `npm run typecheck` pass after the transformer is updated.
- A v3 topic response includes every new property. A pre-v3 response includes
  none of them (not `null`).

## Out of scope

- Solr schema changes (`sem.root.topics.v1.schema.json`). Already present in the
  submodule.
- Search, filtering or sorting on the new properties.
- Versioning the public API.
