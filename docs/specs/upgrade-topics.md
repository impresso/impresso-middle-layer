# Upgrade Topics to Topic Labels v3 (Solr `TopicSolrDocument`)

Status: draft (2026-10-21, updated after review). Decisions 1, 2, 3, 4 and 6
are recorded below. Decision 5 (cache freshness) is still open.

## Goal

Integrate **every field** declared on `TopicSolrDocument`
(`src/models/generated/impressoSchemas/solr/semanticEnrichment.d.ts`) into the
Feathers topics pipeline, so that topic documents carrying the topic-labels v3
metadata are read from Solr, stored in the Redis topics cache, and returned by
the `topics` service.

The pre-v3 fields (`tp_desc_s`, `tp_meta_s`, `tp_nb_i`) are included too.

## Implementation status

Implemented (internal pipeline only):

- `src/schema/app/cache/CachedTopic.json` added, `app/cache` registered in
  `src/scripts/generate-types.js`, generated to `src/models/generated/app/cache.d.ts`.
  The generated file repeats `TopicWord` locally, as expected for the cross-directory `$ref`.
- `src/schema/deprecated/models/InternalTopic.json` deleted, and
  `generated/deprecated/models.d.ts` regenerated without it.
- `topics.model.ts`: `SOLR_FL` covers all fields except `topic_suggest`. Added
  `topicLabelFieldsFromSolr()` (single Solr-to-label mapping, shared by the model
  and `prepareTopics`). The constructor keeps the label fields.
- `prepareTopics.ts`: input typed as a `Pick` of `SolrTopic`. The stub carries the
  label fields, and `topicIndexDocToTopicStub` is exported for tests.
- `cachedResolvers.ts`: keeps the whole cached entry (previously it copied five fields).
- `topics.class.ts`: `InternalTopic` replaced by `TopicResult` (public `Topic` plus
  label fields, `relatedTopics` and `matches`).
- `transformers/topic.ts`: input typed as the public `Topic`. Its mapping is
  unchanged, so the public response does not show the new fields yet.

Deviations from the plan:

- **Step 5.2 (`get` label fields from the cache):** not needed. `get` reads the label
  fields from Solr via `SOLR_FL`.
- **Public transformer and submodule:** not changed. They wait for decision D1 in
  `topics-public-schema.md`.
- **Cache freshness (decision 5):** not changed. Existing caches keep the old shape
  until a rebuild.

Behaviour changes to review:

- The cache now stores the full entry, so `relatedTopics` is populated. Before this
  change the resolver dropped it, the model defaulted it to `[]`, and `get` returned
  an empty `relatedTopics`. `get` and `find` now return the real related topics in
  internal API mode. `topics-graph` was already reading them from the cache.

Pre-existing issue found, not changed:

- `topics.class.ts` `get()` checks `cached.contentItemsCount`, but the model stores
  this value as `countItems`. That branch never runs, so the cached
  `contentItemsCount` is never used by `get`.

Verification:

- `npm run generate-internal-types` produces no diff outside `app/cache` and
  `deprecated/models`.
- `npm run typecheck` shows only the five existing `csv-parse` errors (missing
  package in `node_modules`, unrelated to this change).
- `npm run lint` is clean.
- Unit tests for models, use cases, the topics service, internal services and Solr
  pass (32). Full `npm test` cannot load because of the same missing `csv-parse`
  package, which affects the provenance test files.

## Decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Public property names | Human-readable camelCase names generated from the schema description comment (not from the Solr field name). See the mapping table. |
| 2 | Exposure | Expose `tp_nb_i`, `tp_desc_s`, `tp_meta_s` and all v3 fields. `topic_suggest` stays internal (it is only used by the `q` search). |
| 3 | Search and filtering on label fields | **Out of scope.** |
| 4 | Suggestion path (`q`) label data | **Out of scope.** |
| 5 | Cache freshness | **Open.** See "Cache freshness (open decision)" below. |
| 6 | Legacy `InternalTopic` type | **Move off it.** Replace it with a new cache type, described in "Type migration". |

## Source of truth

`TopicSolrDocument` (generated, do not edit by hand) declares 13 fields:

| Solr field | TS type | Required | Description (from the schema comment) |
| --- | --- | --- | --- |
| `id` | `string` | yes | Unique identifier for the topic |
| `lg_s` | `string` | yes | Language code (ISO lowercase) |
| `tp_model_s` | `string` | yes | Topic model identifier |
| `tp_nb_i` | `number` | yes | Topic number (integer field) |
| `word_probs_dpf` | `string` | yes | Word probabilities in DPFS format |
| `topic_suggest` | `string` | yes | Space-separated topic words for suggestion/autocomplete |
| `tp_desc_s` | `string` | no | Optional topic description |
| `tp_meta_s` | `string` | no | Optional topic metadata |
| `topic_type_s` | `string` | no (v3) | Topic category assigned by the label-generation model |
| `label_short_s` | `string` | no (v3) | Short human-readable topic label |
| `label_long_txt_en` | `string` | no (v3) | Long-form English topic label/description |
| `confidence_s` | `"high" \| "medium" \| "low"` | no (v3) | Confidence level of the generated label |
| `representative_terms_ss` | `string[]` | no (v3) | Representative terms backing the generated topic label |
| `generated_by_s` | `string` | no (v3) | Attribution for the topic-label generation process |

Notes:

- The 9 v3 fields are **optional**: they are absent on pre-v3 documents. Every
  code path must handle `undefined`, not only the happy path.
- `TopicSolrDocument` has an index signature. The consolidated type `Topic` in
  `src/models/consolidated/solr/index.ts` is `Sealed<TopicSolrDocument>`, which
  strips it. Keep using the sealed type so the new fields are typed.

## Field mapping

Property names are generated from the schema comment, following the team
convention (human-readable, not the Solr name). Where two comments would
produce the same name, the more specific comment wins and the other gets a
qualifier.

| Solr field | Comment (summary) | Cache / model name | Public API name | Exposed |
| --- | --- | --- | --- | --- |
| `id` | Unique identifier | `id` | `id` | yes (today) |
| `lg_s` | Language code | `language` | `language` | yes (today) |
| `tp_model_s` | Topic model identifier | `model` | `model` | yes (today) |
| `word_probs_dpf` | Word probabilities | `words` | `words` | yes (today) |
| `tp_nb_i` | Topic number | `topicNumber` | `topicNumber` | yes |
| `topic_suggest` | Words for suggestion/autocomplete | — | — | no (search only) |
| `tp_desc_s` | Optional topic description | `description` | `description` | yes |
| `tp_meta_s` | Optional topic metadata | `metadata` | `metadata` | yes |
| `topic_type_s` | Topic category | `category` | `category` | yes |
| `label_short_s` | Short human-readable topic label | `label` | `label` | yes |
| `label_long_txt_en` | Long-form English topic label | `longLabel` | `longLabel` | yes |
| `confidence_s` | Confidence level of the label | `confidence` | `confidence` | yes |
| `representative_terms_ss` | Representative terms of the label | `representativeTerms` | `representativeTerms` | yes |
| `generated_by_s` | Attribution of label generation | `generatedBy` | `generatedBy` | yes |

Naming note: `tp_desc_s` ("topic description") and `label_long_txt_en`
("label/description") both mention description. The spec gives the first one
`description` and the second one `longLabel` to avoid a clash. Confirm this
before implementation.

All new public properties are **optional**, matching the Solr fields, so
pre-v3 topics stay valid.

## Current state (gap analysis)

Only 4 of the 13 fields reach the application today.

### `src/models/topics.model.ts`

- `SOLR_FL` = `['id', 'lg_s', 'word_probs_dpf', 'tp_model_s']`. None of the new
  fields are requested from Solr, so `get` cannot return them.
- `solrFactory()` and `solrFacetFactory()` map only the 4 fields above.
- `solrSuggestFactory()` builds topics from the suggest payload only. It stays
  unchanged (decision 4).
- The constructor accepts only `id`, `language`, `model`, `words`,
  `relatedTopics`, `countItems`, `x`, `y`, `degree`, `pagerank`, `community`.
  Any other field is dropped silently.
- `class Topic implements ITopic`, where `ITopic` is the public `Topic` from
  `app/entities`. That type has none of the new fields.

### `src/useCases/prepareTopics.ts`

- `TopicIndexDocument` is hand-written and drifts from the schema. It does not
  use `TopicSolrDocument`.
- `topicIndexDocToTopicStub()` keeps only `id`, `language`, `model`, `words`.
  The stub is what gets cached, so every other field is lost before caching.
- `buildRequestGetTopics()` sends no `fl`, so Solr returns all stored fields.
  This needs checking against a live collection (see Verification).
- Uses `InternalTopic` in 7 places (see Type migration).

### `src/internalServices/cachedResolvers.ts`

- `getTopicResolver()` → `loadTopicsData()` rebuilds each cached topic with
  only `id`, `language`, `words`, `contentItemsCount`, `model`. `find` reads
  through this resolver, so new fields are lost here even if the cache has them.

### `src/services/topics/topics.class.ts`

- `find()` gets topics from `resolvers.topic(...)`. Both the `q` path and the
  facet path spread the cached object, so they work once the resolver is fixed.
- `get()` calls `asGet(..., { fl: SOLR_FL })` and then merges the cache. The
  merge returns `contentItemsCount` **or** `relatedTopics`, never both. The
  label fields must survive every branch.
- Typed with `InternalTopic` (see Type migration).

### `src/transformers/topic.ts`

- `transformTopic` **whitelists** the output fields
  (`id, language, contentItemsCount, words, model`). Any field not added here is
  removed from the public response.

### `src/services/topics/topics.schema.ts` and `topics.hooks.ts`

- No change needed for the upgrade. `topics.schema.ts` only holds OpenAPI
  parameters (`q`, `order_by`, `filters`). Response schemas reference `Topic`
  from the `impresso-schemas` submodule, which is where the public properties
  must be added.
- `topics.hooks.ts` maps `order_by` to `word_probs_dpf` and `tp_model_s`. No
  change needed. Label-based sorting is out of scope (decision 3).

### `src/services/topics-graph/topics-graph.class.js`

- Also reads `WellKnownKeys.Topics` from the cache and rebuilds each entry with
  `new Topic(d)`. It depends on the same model constructor, so the constructor
  change in Step 2 affects it. It must keep working with the new cache shape.

## Type migration (decision 6)

### Rationale

Why move off `InternalTopic`:

- **It is in the phase-out folder.** `src/schema/README.md` defines
  `deprecated/` as "all old schemas that are being phased out". `InternalTopic`
  lives in `src/schema/deprecated/models/`, and its generated type in
  `src/models/generated/deprecated/models.d.ts`.
- **New code has to avoid legacy types.** AGENTS.md says legacy code must not be
  used as a design reference, and new code uses the current Feathers, Sequelize
  and BullMQ patterns. Extending `InternalTopic` for the v3 fields would add more
  surface to a type we want to remove.
- **Its shape mixes concerns.** `InternalTopic` holds the public topic fields
  (`id`, `language`, `words`, `model`), the cache counters, and the graph
  metrics computed in `prepareTopics`. Separate types make each role explicit:
  `Topic` for the public contract, `CachedTopic` for the stored data.
- **The public type already exists.** `Topic` in `app/entities` is generated from
  the public schema, so the service and transformer can use it directly. Keeping
  `InternalTopic` as a second copy of the same fields invites drift.

Alternatives considered:

- **Extend `InternalTopic`.** Rejected: it keeps the legacy type alive and adds
  the v3 fields to it.
- **Use `TopicSolrDocument` as the cache type.** Rejected: see the note below.
- **Create `CachedTopic` (chosen).** A new schema with the names the cache and
  service need. It is generated, and it can be removed or renamed independently
  of the public contract.

Will `InternalTopic` be deprecated? It already is, in the sense that the
`deprecated/` folder is where it is meant to end up. `InternalTopic` is only used
by the four topics files listed above (checked with grep, excluding generated
code), so once those are migrated nothing references it, and its schema can be
deleted in the same change. The folder itself stays: 22 other files import other
types from `generated/deprecated`, and those are outside this spec.

`InternalTopic` (`src/schema/deprecated/models/InternalTopic.json`, generated
into `src/models/generated/deprecated/models.d.ts`) is used in:

- `src/useCases/prepareTopics.ts` (7 references)
- `src/internalServices/cachedResolvers.ts`
- `src/transformers/topic.ts`
- `src/services/topics/topics.class.ts`

Target types:

| Purpose | Type | Source |
| --- | --- | --- |
| Public topic (API response) | `Topic`, `TopicWord` | `app/entities` (generated from the `impresso-schemas` submodule) |
| Cache entry (graph and internal data) | `CachedTopic` (new) | `src/schema/app/cache/CachedTopic.json`, generated to `src/models/generated/app/cache.d.ts` |

`TopicSolrDocument` is **not** a target for the cache or the API. It describes the
Solr document: Solr field names (`lg_s`, `tp_model_s`), `word_probs_dpf` as one
DPFS string, and no fields for counts, related topics or graph metrics. Those are
computed by `prepareTopics`. Use `TopicSolrDocument` only as the **input** type of
`prepareTopics` (`Pick<TopicSolrDocument, ...>`), and map it into `CachedTopic`.

`CachedTopic` extends the public fields with the graph metrics and related
topics (`relatedTopics`, `relatedTopicsStats`, `degree`, `pagerank`,
`community`, `hub`, `authority`, `x`, `y`, `contentItemsCount`). Use the
`app/entities` `TopicWord` for `words`, not the deprecated one, since the
shapes are the same.

Plan:

1. Add `src/schema/app/cache/CachedTopic.json`. Register `app/cache` in
   `schemaBits` in `src/scripts/generate-types.js`. The generator only compiles
   directories listed there, and writes one file per directory
   (`app/cache` gives `generated/app/cache.d.ts`). Run `npm run generate-types`.
   The schema is local to this repo, so no submodule change is needed.
2. Migrate each reference listed above to `Topic` or `CachedTopic`.
3. Once no references remain, delete `InternalTopic.json` and regenerate. The
   removal confirms the migration is complete (the compiler will fail if any
   reference is left).

Note: the service response of `get` in internal API mode includes
`relatedTopics`, which is not on the public `Topic`. That is expected, so the
service return type is `Topic` plus the optional fields it adds, not `Topic`
alone. Confirm this shape in Step 5.

## Implementation plan

### Step 1: Schemas and generated types

1. Add the new public properties to the `impresso-schemas` public-api
   `entities/Topic.json` (optional, with descriptions). Commit in the submodule.
2. Add `src/schema/app/cache/CachedTopic.json` and register `app/cache` in
   `schemaBits` (see Type migration).
3. Run `npm run generate-types`. Confirm the diffs contain only the new types
   and fields.
4. Check `TopicSolrDocument` is the current generated version
   (`npm run generate-types-from-schemas-repo` gives no diff).

Done when: `npm run generate-types` is clean and the new types exist.

### Step 2: Solr read path (`topics.model.ts`)

1. Extend `SOLR_FL` to every returned field (all except `topic_suggest`), typed
   as `(keyof ISolrTopic)[]` so the compiler checks each name.
2. Extend `solrFactory()` and `solrFacetFactory()` to map the new fields. Optional
   Solr fields map to `undefined` when absent, not `''`.
3. Extend the constructor so the new fields are kept. Keep the existing behaviour
   for `words`, `excerpt`, `x`, `y`.
4. Switch `implements ITopic` and the types to `Topic` and `CachedTopic`.

Done when: `Topic.solrFactory()` returns all fields for a v3 document and no label
fields for a pre-v3 document.

### Step 3: Cache build (`prepareTopics.ts`)

1. Replace `TopicIndexDocument` with `Pick<TopicSolrDocument, ...>` (or the sealed
   `Topic` from `@/models/consolidated/solr/index.js`), plus `_version_`.
2. Extend `topicIndexDocToTopicStub()` with explicit fields. Do not spread the
   Solr document, so the cache does not store `topic_suggest` or `_version_`.
3. Keep `words` truncated to `TopNTopics`. Label fields are not truncated.
4. Replace the `InternalTopic` types with `CachedTopic`.

Done when: the output contains the new fields for v3 documents and leaves them
out (not `null`) for pre-v3 documents.

### Step 4: Cache read path (`cachedResolvers.ts`)

1. Copy every `CachedTopic` field in `loadTopicsData()`, not only the current five.
2. Confirm `new Topic(topic)` keeps them (depends on Step 2).

Done when: `resolvers.topic(id)` returns the label fields for a cached v3 topic.

### Step 5: Service (`topics.class.ts`)

1. `find()`: no structural change. Check that the facet path and the `q` path keep
   the new fields.
2. `get()`: include label fields from the Solr response (`SOLR_FL`) and from the
   cache. In the cache merge, return the label fields in every branch. Keep the
   `contentItemsCount` / `relatedTopics` behaviour.
3. Replace `InternalTopic` with `Topic` (plus the optional fields the internal API
   returns).

Done when: `get` and `find` return the same label fields for the same topic.

### Step 6: Public transformer (`src/transformers/topic.ts`)

1. Add the new public properties with explicit mapping. Do not spread the input,
   so internal fields are not exposed by accident.
2. Keep `undefined` for absent optional fields so JSON omits them.

Done when: a v3 topic's public response has all new properties, and a pre-v3
topic's response has none of them.

### Step 7: Tests

Follow AGENTS.md (`assert` from `assert/strict`, narrow mocks).

- `test/unit/models/topics.model.test.ts`: `solrFactory` with and without v3
  fields. Check that `SOLR_FL` covers every `TopicSolrDocument` field except
  `topic_suggest`.
- `test/unit/useCases/prepareTopics*.test.ts` (new): the stub mapping for v3 and
  pre-v3 documents.
- `test/unit/services/topics/topics.class.test.ts`: `get` returns label fields in
  each cache branch.
- `test/unit/transformers/topic.test.ts` (new): whitelist, absent fields omitted.
- `test/integration/services/topics.test.js`: end-to-end with a v3 fixture, once
  one exists.

## Cache freshness (open decision 5)

Two things make the cache refresh.

**Startup job.** `src/jobs/index.ts` runs `updateTopicsCache` on every startup.
That job returns early when the key already exists:

```ts
// src/jobs/updateTopicsCache.ts
const run = async (app: ImpressoApplication) => {
  const cache = app.get('cacheManager')
  const solrClient = app.service('simpleSolrClient')

  const cached = await cache.get(WellKnownKeys.Topics)
  if (cached != null) return

  const topics = await prepareTopics(solrClient)
  await cache.set(WellKnownKeys.Topics, JSON.stringify(topics), DefaultTtlSeconds)
  await cache.set(WellKnownMetadataKeys.TopicsComputedAt, new Date().toISOString(), DefaultTtlSeconds)
}
```

So after deploying the new code, an existing cache keeps the old shape. Nothing
refreshes it until the key expires (the TTL is about 100,000 days because of the
double `* 1000` in `DefaultTtlSeconds`, so it effectively never expires).

**Manual rebuild.** The admin service already supports a full rebuild.
`src/services/admin/admin.class.ts` handles `rebuild-well-known-cache` by
queuing `rebuildWellKnownCache`. That job (`src/jobs/rebuildWellKnownCache.ts`)
deletes the well-known keys and then runs every `update*` job, including topics.
It has to be triggered by hand.

Options:

- **A. Manual rebuild only.** Keep the code as is. After deploy, call
  `rebuild-well-known-cache` once. No code change. Risk: someone forgets, and
  the API silently serves the old shape.
- **B. Versioned cache key (recommended).** Store a schema version next to the
  topics payload (for example a `cache:meta:topics:version` key holding
  `topics-v3`). `updateTopicsCache` rebuilds when the stored version differs
  from the code's version. The rebuild happens automatically on the first start
  after deploy. Small change, no manual step, and the version can be bumped
  again for future shape changes.
- **C. Always rebuild on startup.** Remove the early return. Simplest, but every
  startup runs the full Solr scan, and each replica runs it at the same time.

Decision needed: A, B or C. The spec currently assumes B.

## Rollout

1. Deploy the code with the schema changes.
2. Refresh the cache according to decision 5. With option A, run
   `rebuild-well-known-cache` through the admin service. With option B, nothing
   is needed.
3. Check `cache:meta:topics:computedAt` moved forward.
4. Spot-check `GET /topics/{id}` and `GET /topics?q=...` for one v3 topic and one
   pre-v3 topic. Check that `topics-graph` still returns data.

The change is additive. The new properties are optional, so no breaking change
is planned for clients.

## Verification

Before Step 2, confirm against a live Solr `topics` collection:

- The v3 fields are stored and returned when `fl` is not set. Otherwise
  `SOLR_FL` and `prepareTopics` need an explicit `fl`.
- Pre-v3 documents return no value for the v3 fields (not empty strings).
- `representative_terms_ss` returns an array, not a string.
- `confidence_s` only contains `high`, `medium` or `low`.

## Out of scope

- Search, filtering and sorting on label fields (decision 3).
- Suggestion path label data (decision 4).
- Changes to how topic-model relations are computed (`relatedTopics`, graph
  metrics, HITS, pagerank, communities).
- The `DefaultTtlSeconds` double multiplication in `updateTopicsCache.ts`
  (found during the review; fix separately).
- The `topics_dpfs` facet and content-item topic fields.
