# Spec — Solr JSON Query Builder

Status: **Draft for implementation**
Supersedes: `filtersToQueryAndVariables` (`src/util/solr/index.ts`) and `filtersToSolr` (`src/util/solr/filterReducers.ts`)
Scope of this document: design specification + acceptance criteria. No implementation.

---

## 1. Purpose

Convert a list of `Filter` objects into a **Solr JSON Request API** body fragment
(`query`, `filter`, `params`) using the [JSON Query DSL](https://solr.apache.org/guide/solr/latest/query-guide/json-request-api.html),
rather than the flat `q`/`fq` string parameters produced today.

The module must satisfy four goals:

1. **One pane of mapping.** Every `(solr namespace, filter type) → (solr field(s), rule, scoring)` mapping lives in
   exactly one place: `src/util/solr/solrFilters.yml`. Adding a filter type is a YAML edit; adding a *rule*
   is a YAML edit plus one rule implementation.
2. **Structured composition.** Boolean composition is expressed as JSON DSL nodes (`bool`/`must`/`must_not`/`filter`),
   never as hand-concatenated Lucene strings. This eliminates the operator-precedence class of bugs by construction.
3. **Correct placement.** Each filter lands in the scored clause or the unscored/cacheable clause according to a
   declared property, not a hardcoded list of filter type names.
4. **Corner-case aware.** Rules that cannot coexist with other clauses in the main query (currently: KNN vector
   search) restructure the whole request deterministically.

### 1.1 Non-goals

- Faceting, highlighting configuration (beyond the `hl` interaction in §7), field lists, pagination, `sort`.
  Those remain the caller's responsibility; this module only produces `query`, `filter` and `params`.
- Changing the semantics of individual filter *values* (date normalisation, precision handling, ID escaping,
  regex splitting…). Those are ported as-is.
- A compatibility shim or staged migration of existing callers (explicitly out of scope for this round).

---

## 2. Public interface

```ts
import type { Filter } from '@/models/index.js'
import type { SolrNamespace } from '@/solr.js'
import type { FeaturesConfig, SolrServerNamespaceConfiguration } from '@/models/generated/app/configuration.js'

export interface BuildSolrQueryOptions {
  /**
   * When set, and the value references `$topicRelevanceScore`, the corresponding
   * function query is emitted into `params`. See §8.2.
   */
  orderBy?: string
  /**
   * Hoist long leaf queries into `params` as `$v0`, `$v1`, … See §8.3.
   * Default: `false`.
   */
  extractVariables?: boolean | { minLength: number }
}

export interface SolrJsonQueryBody {
  query: SolrQueryNode
  filter: SolrQueryNode[]
  params: Record<string, string | number | boolean>
}

export function buildSolrQuery(
  filters: Filter[],
  solrNamespace: SolrNamespace,
  solrNamespaceConfiguration: SolrServerNamespaceConfiguration[],
  featuresConfig: FeaturesConfig,
  options?: BuildSolrQueryOptions
): SolrJsonQueryBody
```

The function is **pure** and **synchronous**. It performs no I/O; the parsed registry (§4) is loaded once at
module initialisation.

**Prerequisite:** `SelectRequestBody` in `src/internalServices/simpleSolr.ts` currently types `query` and
`filter` as strings. It must be widened to accept `SolrQueryNode` / `SolrQueryNode[]`. This is an assumption
of this spec, not verified against that file.

---

## 3. The query node type

A Solr JSON DSL query node is one of:

```ts
export type SolrQueryNode =
  /** A bare Lucene query string is itself a valid JSON DSL node. Used for all leaf field queries. */
  | string
  | { bool: SolrBoolNode }
  | { lucene: { query: string; df?: string; 'q.op'?: 'AND' | 'OR' } }
  | { knn: { f: string; topK: number; query: string; preFilter?: string } }
  | {
      join: {
        from: string
        to: string
        fromIndex?: string
        method?: 'index' | 'crossCollection' | 'dvWithScore' | 'topLevelDV'
        checkRouterField?: boolean
        query: string
      }
    }
  /** Escape hatch: any Solr query parser, `{ "<parserName>": { ...localParams, query } }`. */
  | Record<string, Record<string, unknown>>

export interface SolrBoolNode {
  must?: SolrQueryNode[]
  must_not?: SolrQueryNode[]
  should?: SolrQueryNode[]
  minimum_should_match?: number | string
}
```

Solr's `bool` also accepts a `filter` clause (non-scoring AND). It is **deliberately excluded** from this
type — see §3.2. Non-scoring placement is expressed by the top-level `filter` array instead, so there is
exactly one way to say it.

Notes:

- A bare string leaf is deliberate and correct: the JSON DSL treats a string as a `lucene`-parsed query.
  Structure is applied at composition level; leaves stay readable (`"meta_journal_s:SGZ"`).
- `{ "<parser>": { … } }` is Solr's generic mapping onto local params — `{"knn": {"f": "x", "topK": 10, "query": "[…]"}}`
  is equivalent to `{!knn f=x topK=10}[…]`. The `query` key maps onto the parser's `v` local param.

### 3.1 Two mandatory composition invariants

These are correctness rules, not style preferences.

**I1 — Never mix `must` and `should` in the same `bool` node.**
In Solr, when a `bool` node contains `must` clauses, the `should` clauses become *optional* (score-boosting
only) and stop constraining the result set. Any OR-group must therefore be its own nested `bool` node placed
inside the parent's `must` array. Emit `minimum_should_match: 1` explicitly on every `should`-only node.

Consequence: every `bool` node this module emits is **homogeneous** — it is an AND node (`must` only), an OR
node (`should` + `minimum_should_match: 1`), or a NOT node (`must` + `must_not`, per I2). We are using `bool`
as a typed AST for AND/OR/NOT, not exploiting Lucene's mixed-occurrence scoring semantics.

**I2 — A `bool` node whose only clauses are `must_not` must also carry `must: ["*:*"]`.**
Pure-negative boolean queries match nothing in Lucene unless paired with a match-all clause. This is the same
hazard the legacy `*:* AND NOT (…)` string hack worked around; here it is applied once, structurally, by the
composer. (See §11 open item O3 — Solr may insert this implicitly, but the builder emits it unconditionally so
behaviour does not depend on the Solr version.)

### 3.2 How `bool` maps onto Solr query language, and why we use it

`bool` is not a separate query language — it is a direct constructor for a Lucene `BooleanQuery`, the same
object the standard query parser builds from `AND`/`OR`/`NOT`. Each key sets the *occurrence* of its clauses:

| JSON DSL | Lucene occurrence | Lucene string equivalent | Scores? | Cacheable as a filter? |
| -------- | ----------------- | ------------------------ | ------- | ---------------------- |
| `must: [A, B]` | `MUST` (`+`) | `A AND B` / `+A +B` | yes | no |
| `should: [A, B]` + `minimum_should_match: 1` | `SHOULD` | `A OR B` | yes | no |
| `must_not: [B]` | `MUST_NOT` (`-`) | `NOT B` / `-B` | n/a (never scores) | n/a |
| `filter: [A]` | `FILTER` | `filter(A)` | no (constant 0) | yes |

So there is a 1:1 string equivalent for everything we emit. The question is therefore genuinely open, and the
answer is different for the **leaves** than for the **composition**.

**Leaves stay Lucene strings.** `"meta_journal_s:SGZ"`, `"meta_date_dt:[… TO …]"`, `"content_txt_fr:/moo/"` —
no gain from structuring these, and considerable loss of readability. A bare string is a valid JSON DSL node,
so this costs nothing.

**Composition uses `bool`.** Three reasons, in descending order of weight:

1. **Nested query parsers only compose in the DSL.** A `{!join …}` or `{!knn …}` local-params prefix is only
   honoured at the *start* of a query string. There is no way to write `{!join …}X AND lg_s:en` as a plain
   string; you need the `_query_:"{!join …}"` magic-field trick or a `v=$var` indirection. In the DSL,
   `{"bool": {"must": [{"join": {…}}, "lg_s:en"]}}` is ordinary. Today this limitation is hidden only because
   `joinCollection` always lands alone in its own `fq` entry — the moment a collection filter needs to be
   OR-ed with anything, the string form breaks. This alone decides it.
2. **The output is testable by structure.** `assert.deepStrictEqual` on a tree beats exact-string comparison
   against 500-character Lucene expressions, which is what the current test suite does and why those tests are
   brittle.
3. **Precedence cannot be got wrong.** A string composer *can* be correct if it parenthesises every child
   unconditionally — but the current implementation is proof that "can be" is not "is" (§6.3). With a tree,
   precedence is not expressible as a bug.

Against: the emitted body is more verbose, and `content_txt:"chat" AND NOT (lg_s:en OR lg_s:de)` is easier to
read at a glance than its tree. Debuggability is preserved by Solr's `debug.query` output, which echoes the
parsed query in string form regardless of how it was submitted.

**Do we need all four keywords? No — three.** `must`, `should` and `must_not` are each irreplaceable: they are
AND, OR and NOT, and I1/I2 keep every node homogeneous so each maps to exactly one operator. `bool.filter` is
dropped: the only thing it offers over `must` is non-scoring/cacheable evaluation, and the top-level `filter`
array already provides that for the whole clause set (§6.2). Keeping both would mean two spellings of
"unscored AND" and a decision to make each time. If a future rule genuinely needs an unscored sub-clause
*inside* a scored tree, add `filter` to `SolrBoolNode` then, with a documented reason.

---

## 4. The registry: `solrFilters.yml`

### 4.1 Shape

Unchanged structure, one new property per filter definition:

```yaml
indexes:
  search:
    filters:
      string:
        field: { prefix: content_txt_ }
        rule: string
        scoring: true          # NEW — participates in relevance scoring
      newspaper:
        field: meta_journal_s
        rule: value            # scoring omitted => false
```

| Property      | Type                                          | Required | Default | Meaning |
| ------------- | --------------------------------------------- | -------- | ------- | ------- |
| `field`       | `string` \| `string[]` \| `{ prefix: string }` | yes      | —       | Solr field(s). Shape must match what the rule accepts (§5.1). |
| `rule`        | `string`                                       | yes      | —       | Name of a rule in the rule registry (§5). |
| `scoring`     | `boolean`                                      | no       | `false` | `true` → clause goes into the scored `query`; `false` → into the unscored, cacheable `filter` array. |
| `destination` | `"query"` \| `"filter"`                        | no       | —       | **Deprecated.** Ignored by the builder. Retained in the schema only so existing YAML validates during the transition; delete once all entries carry `scoring`. |

### 4.2 Why `destination` is subsumed by `scoring`

Today a filter reaches Solr in one of three ways:

| Today | Effect |
| ----- | ------ |
| `destination: filter` | appended to `fq` — unscored, cached |
| `destination: query` + type in `NON_FILTERED_FIELDS` | appended raw to `q` — **scored** |
| `destination: query` + type not in that list | appended to `q` wrapped in `filter(…)` — unscored, cached |

Rows 1 and 3 are semantically identical (`filter(x)` inside `q` is exactly a non-scoring, cacheable clause).
So the only real distinction is *scored vs not scored*, which is what `scoring` expresses. The `filter(…)`
wrapper and the `NOT filter(` / `substr(4)` hack in `wrapAsFilter` are removed entirely; the top-level
`filter` array provides the same non-scoring, cacheable semantics natively (§3.2).

### 4.3 Required migration of the current YAML

`NON_FILTERED_FIELDS = ['id', 'string', 'entity-string', 'topic-string', 'embedding']` maps to exactly these
additions — **every other filter definition keeps the default `scoring: false`**:

| Namespace     | Filter type     | New property     |
| ------------- | --------------- | ---------------- |
| `search`      | `string`        | `scoring: true`  |
| `search`      | `topic-string`  | `scoring: true`  |
| `search`      | `entity-string` | `scoring: true`  |
| `search`      | `embedding`     | `scoring: true`  |
| `tr_passages` | `id`            | `scoring: true`  |
| `tr_passages` | `string`        | `scoring: true`  |
| `entities`    | `string`        | `scoring: true`  |
| `images`      | `embedding`     | `scoring: true`  |
| `images`      | `title`         | `scoring: true`  |

> `tr_passages.id`, `entities.string`, `images.title` and `tr_passages.string` are listed because
> `NON_FILTERED_FIELDS` matches on *filter type name across all namespaces*. Confirm each of these against
> product expectations before landing — this is the one place where the migration is a judgement call rather
> than a mechanical translation. If any of them should not affect scoring, simply omit the property.

### 4.4 JSON-schema changes

`src/schema/app/configuration/solrFilters.json`, in `definitions.FilterDefinition.properties`:

```json
"scoring": {
  "type": "boolean",
  "default": false,
  "description": "Whether this filter participates in relevance scoring. Scoring filters are placed in the main `query` clause; non-scoring filters in the cacheable `filter` clause."
},
"destination": {
  "type": "string",
  "enum": ["query", "filter"],
  "deprecated": true,
  "description": "DEPRECATED and ignored. Superseded by `scoring`."
}
```

Regenerate types with `npm run generate-types`.

### 4.5 Load-time validation (fail fast)

At module init, after parsing the YAML, assert for every `(index, type)` entry:

1. `rule` exists in the rule registry → otherwise throw naming the index, type and unknown rule.
2. The `field` shape is accepted by that rule (§5.1) → otherwise throw naming the expected shape.
3. `scoring: true` is not combined with a rule declared `neverScoring` (none currently).

Failures throw at startup, not per request.

---

## 5. Rules

A rule is the unit that turns *N filters of the same type and the same context* into one query node.

```ts
export interface RuleContext {
  /** Solr field(s) from the registry entry for this (namespace, type). */
  field: string | string[] | { prefix: string }
  /** The filter type name — for error messages. */
  type: string
  /** The namespace being built for. */
  namespace: SolrNamespace
  namespaceConfiguration: SolrServerNamespaceConfiguration[]
  features: FeaturesConfig
}

export interface RuleResult {
  node: SolrQueryNode
  /** Optional params contributed by this rule, merged into the output `params`. */
  params?: Record<string, string | number | boolean>
}

export interface Rule {
  name: string
  /** Field shapes this rule accepts; validated at load time. */
  accepts: Array<'string' | 'string[]' | 'prefix'>
  /**
   * When true the rule receives filters of BOTH contexts and is responsible for
   * negation itself; the composer will not wrap its output in `must_not`.
   * Only `joinCollection` sets this. See §6.3.
   */
  handlesContext?: boolean
  /**
   * When set, a filter using this rule cannot coexist with any other clause in the
   * main query. See §7. Currently only `embeddingKnnSimilarity` sets `exclusive: 'knn'`.
   */
  exclusive?: 'knn'
  build(filters: Filter[], ctx: RuleContext): RuleResult
}
```

**Contract change vs today:** rules no longer emit `NOT` / `*:* AND NOT` themselves. They receive filters of a
single `context` and produce a *positive* query. The composer applies negation structurally. The single
exception is `handlesContext` (§6.3).

`exclusive` is declared on the rule rather than in the YAML because it is an invariant of the query parser
(KNN cannot share the main query), not of a per-index field mapping. If a future rule needs per-index
exclusivity, promote the property to YAML then.

### 5.1 Rule inventory

Ported one-to-one from `filterReducers.ts`. Value-level behaviour (escaping, normalisation, precision,
defaults on empty `q`) is preserved exactly; only the output shape and negation handling change.

| Rule | Accepts `field` | `q` shape | Uses `op` | Uses `precision` | Output node |
| ---- | --------------- | --------- | --------- | ---------------- | ----------- |
| `minLengthOne` | `string` | ignored | no | no | `"<field>:[1 TO *]"` |
| `boolean` | `string` | ignored | no | no | `"<field>:1"` |
| `noop` | any | ignored | no | no | `"*:*"` |
| `numericRange` | `string` | `"A TO B"` or `[a, b]`; absent ⇒ `<field>:*` | no | no | `"<field>:[A TO B]"` |
| `dateRange` | `string` | `"A TO B"`, `[a,b]` pair, or array of ranges; absent ⇒ `<field>:*` | yes (joins array of ranges) | no | leaf string, or `{bool:{should:[…], minimum_should_match:1}}` for an array of ranges |
| `value` | `string`, `string[]` | string or array; empty ⇒ `<field>:*` | yes | no | see §5.2 |
| `idValue` | `string`, `string[]` | as `value`, with `escapeIdValue` applied | yes | no | see §5.2 |
| `capitalisedValue` | `string` | as `value` | yes | no | see §5.2 |
| `imageTypeValueOrLabel` | `string` | as `value`, after label→value lookup via `ImageTypeValueLookup` | yes | no | see §5.2 |
| `string` | `string`, `string[]`, `prefix` | string or array; empty/absent ⇒ `*` | yes | yes | see §5.2 |
| `openEndedString` | `string` | string or array | yes | no | nested `bool` (`AND` between tokens, last token suffixed `*`) |
| `regex` | `string`, `string[]`, `prefix` | single-element array or string; absent ⇒ `/.*/ ` | yes | no | see §5.2, leaves `"<field>:/…/"` |
| `joinCollection` | `string` | collection IDs, string or array | yes | no | `{join: {…}}`, §5.3 |
| `embeddingKnnSimilarity` | `string[]` (`"model:field"` entries) | `"model:base64[:topK]"` | no | no | `{knn: {…}}`, §7 |

`prefix` expands to `SupportedLanguageCodes.map(l => prefix + l)` plus the catch-all `prefix.slice(0, -1)`,
preserving current field order (e.g. `content_txt_fr, …, content_txt_nl, content_txt`).

### 5.2 Standard multi-value / multi-field composition

All value-ish and string-ish rules share one composition shape. Given values `v1…vn`, fields `f1…fm`, and
operator `op`:

- **One value, one field** → leaf string `"f1:v1"`.
- **One value, many fields** → `{bool: {should: ["f1:v1", …, "fm:v1"], minimum_should_match: 1}}`
  (fields are always OR-ed, matching today's behaviour).
- **Many values** → wrap each value's node as above, then combine by `op`:
  - `op: 'OR'` (default) → `{bool: {should: [...], minimum_should_match: 1}}`
  - `op: 'AND'` → `{bool: {must: [...]}}`

Per invariant **I1**, these nest rather than flatten. Multiple filters of the same type are AND-ed by the
composer (§6.2), never merged into one bool node by the rule.

Example — `{type: 'entity', q: ['e-a','e-b'], op: 'AND'}` on `search`:

```json
{ "bool": { "must": [
  { "bool": { "should": ["pers_entities_dpfs:e-a", "loc_entities_dpfs:e-a"], "minimum_should_match": 1 } },
  { "bool": { "should": ["pers_entities_dpfs:e-b", "loc_entities_dpfs:e-b"], "minimum_should_match": 1 } }
]}}
```

### 5.3 `joinCollection`

Sets `handlesContext: true`. Output:

```json
{ "join": {
  "from": "ci_id_s",
  "to": "<field from registry>",
  "fromIndex": "<index of the collection_items namespace>",
  "method": "crossCollection",
  "query": "col_id_s:*_col-123"
} }
```

When `featuresConfig.collectionsIndexVersion === 'new'`, emit `"method": "index"` and `"checkRouterField": false`
instead. The `collection_items` namespace must be resolvable from `solrNamespaceConfiguration`, otherwise throw
(§9, E4). At least one collection ID must be present, otherwise throw (§9, E5).

**Known semantic issue, preserved as-is (see §11, O1):** an `exclude` collection filter currently pushes the
negation *inside* the join subquery (`… NOT col_id_s:*_col-123`), which selects content items belonging to some
*other* collection, rather than items not in that collection. Under semantic parity this behaviour is ported
unchanged. Changing it to an outer `must_not` is a product decision and is flagged, not made, here.

---

## 6. Composition algorithm

### 6.1 Grouping

1. Validate `solrNamespace` is a known namespace (as today).
2. Partition `filters` by `(type, context)`, where `context` defaults to `'include'`.
   For rules with `handlesContext: true`, partition by `type` only.
3. Resolve each type against the registry for `solrNamespace`. Unknown type → throw (§9, E1).
4. Call the rule once per group with the group's filters, in **deterministic order**: groups are ordered by
   first appearance of their `type` in the input array; within a group, filters keep input order; `include`
   groups precede `exclude` groups for the same type. Output must be byte-stable for a given input — this
   matters for Solr's query cache and for tests.

### 6.2 Placement

Three accumulators:

| Accumulator | Receives |
| ----------- | -------- |
| `scored[]` | nodes from `include` groups whose registry entry has `scoring: true` |
| `unscored[]` | nodes from `include` groups whose registry entry has `scoring: false` |
| `negated[]` | nodes from all `exclude` groups, regardless of `scoring` |

All `exclude` groups land in `negated` because `must_not` clauses never contribute to score in Lucene — there
is no such thing as a "scored negation", so splitting them by `scoring` would be meaningless.

Assembly:

```
query  = scored.length === 0 ? "*:*"
       : scored.length === 1 ? scored[0]
       : { bool: { must: scored } }

filter = [...unscored]
if (negated.length > 0)
  filter.push({ bool: { must: ["*:*"], must_not: negated } })   // invariant I2
```

`filter` is `[]` when there is nothing unscored or negated. `params` per §8.

### 6.3 Negation

The composer owns negation. This is the main behavioural fix over the current implementation, which builds
`NOT …` inside each rule and then joins groups with a flat ` AND `, producing wrong precedence when a negated
group contains an OR.

Concretely, the current test `handles negations correctly` expects:

```
(…"chat"…) AND NOT (…"pet"…) OR (…"pets"…)
```

which Lucene parses as `((A AND NOT B) OR C)` — the `pets` clause escapes the negation entirely and the whole
query becomes a disjunction. The new output is:

```json
{
  "query": { "bool": { "must": ["…chat…"] } },
  "filter": [
    "content_length_i:[1 TO *]",
    { "bool": { "must": ["*:*"], "must_not": [ { "bool": { "should": ["…pet…", "…pets…"], "minimum_should_match": 1 } } ] } }
  ]
}
```

i.e. `chat AND NOT (pet OR pets)`. **This changes results for existing queries that combine an exclude filter
carrying multiple values with any other filter.** It is an intentional bug fix under the agreed
"semantic parity, free to restructure" mandate, and must be called out in the release notes.

---

## 7. KNN / exclusive-query mode

A rule declaring `exclusive: 'knn'` cannot share the main query with any other clause: Solr's `knn` parser
retrieves the top-K nearest vectors and is not composable as a boolean operand in the way ordinary field
queries are. Today the implementation silently AND-joins multiple KNN clauses into one string, producing an
ill-defined query.

**Detection.** After grouping (§6.1), count groups whose rule declares `exclusive`.

**Rules.**

1. **More than one exclusive filter → throw** (§9, E6). This includes two `embedding` filters of the same type,
   which the current code accepts and mis-joins.
2. **Exactly one exclusive filter** — the request is restructured:
   - `query` = the KNN node **alone**. The `scoring` property of every other filter is ignored.
   - Every other group's node is appended to `filter`, in the deterministic order of §6.1: `unscored` first,
     then what would have been `scored`, then the negation node.
   - `params.hl = false` — highlighting must be disabled for KNN searches. The builder sets this
     unconditionally in this mode; a caller-supplied `hl` is overridden (log at debug level if overriding).
3. **Zero exclusive filters** → §6.2 applies unchanged.

**Node shape.** For `q = "gte-768:<base64>[:topK]"` against `field: ["gte-768:gte_multi_v768"]`:

```json
{ "knn": { "f": "gte_multi_v768", "topK": 10, "query": "[0.1,0.2,0.3]" } }
```

`query` is the JSON-serialised float array as a **string** (the parser's `v` local param). `topK` comes from
the optional third colon-separated segment of `q`, defaulting to `10`. Vector decoding
(base64 → `Float32Array` → array) and the unknown-model error are ported unchanged. Deriving `topK` from the
request's `limit`/`offset` remains an open TODO and is explicitly **not** part of this spec.

**Example.**

```
filters: [ {type:'embedding', q:'gte-768:…'}, {type:'string', q:'chat'}, {type:'newspaper', q:'SGZ'} ]
```

```json
{
  "query":  { "knn": { "f": "gte_multi_v768", "topK": 10, "query": "[…]" } },
  "filter": [ "meta_journal_s:SGZ", { "bool": { "should": ["content_txt_fr:chat", "…"], "minimum_should_match": 1 } } ],
  "params": { "hl": false }
}
```

Note that `string` — a `scoring: true` filter — has moved into `filter`. This is the defining property of the
mode: under KNN, relevance ordering comes from vector distance, so no other clause may contribute to score.

**Pre-filter vs post-filter semantics.** Whether the clauses in `filter` restrict the candidate set *before*
the vector search (pre-filtering, returning up to `topK` matching documents) or are applied *after* the top-K
vectors are collected (post-filtering, potentially returning far fewer than `topK` documents) depends on the
deployed Solr version — recent Solr versions added an explicit `preFilter` local param to the `knn` parser and
changed the default behaviour for main-query KNN. **I have not verified which behaviour the Solr version
deployed for Impresso exhibits**, and the difference is user-visible (a filtered KNN search can come back
nearly empty under post-filtering). Implementation must:

- determine the deployed Solr version's behaviour empirically before landing;
- if it is post-filtering, emit an explicit `preFilter` on the `knn` node carrying the same clauses, so the
  behaviour is pinned rather than version-dependent;
- record the finding in this document (§11, O2).

---

## 8. `params`

`params` is a flat map merged from three sources. A key written twice with different values → throw (§9, E7).

### 8.1 Rule-contributed params

A rule may return `params` alongside its node — e.g. request knobs such as `defType`, `q.op` or `mm` that a
future parser-specific rule requires. No current rule contributes params except via §8.2/§8.3.

### 8.2 Sort / relevance params

When `options.orderBy` contains `$topicRelevanceScore`, emit:

```json
"params": { "topicRelevanceScore": "sum(payload(topics_dpfs,tm-fr-all-v2.0_tp44_fr),…)" }
```

built from all `topic` filters in the input (`escapeIdValue` applied to each ID), or `"0"` when there are no
topic filters. This folds today's `getTopicRelevanceFunction` / `getSortParams` into the builder so that the
function query and the filters it references cannot drift apart. `getSortParams` remains as a thin caller-side
helper for the `sort` string itself, which this module does not produce.

### 8.3 Query-referenced variables

When `options.extractVariables` is enabled, any leaf whose serialised length exceeds the threshold
(default `1024` characters — chosen so that KNN vectors and very large ID disjunctions are hoisted while
ordinary clauses are not) is replaced by the reference `"$v<N>"` and its value moved to `params.v<N>`.
Numbering is sequential in the deterministic emission order of §6.1, starting at `v0`. This keeps the query
body readable and is the JSON-API equivalent of the currently commented-out variables mechanism in
`filtersToQueryAndVariables`.

Disabled by default; when disabled `params` contains only §8.1/§8.2 entries (and `hl` under §7).

---

## 9. Errors

All errors are `InvalidArgumentError` (`@/util/error.js`), thrown synchronously. Messages are part of the
contract and are asserted by tests.

| ID | Condition | Message |
| -- | --------- | ------- |
| E1 | Filter type absent from the registry for the namespace | `Unknown filter type "<type>" in namespace "<ns>"` |
| E2 | Registry references an unknown rule (load time) | `Unknown rule "<rule>" for filter type "<type>" in namespace "<ns>"` |
| E3 | Field shape not accepted by the rule (load time) | `Rule "<rule>" does not accept field shape <shape> (filter type "<type>", namespace "<ns>")` |
| E4 | `joinCollection` cannot resolve the collection namespace | `Could not find Solr namespace configuration for "collection_items" required for "joinCollection" filter` *(unchanged)* |
| E5 | `joinCollection` with no collection IDs | `At least one collection ID must be provided for "joinCollection" filter` *(unchanged)* |
| E6 | More than one exclusive (KNN) filter | `Only one "<type>" filter is supported per request; received <n>` |
| E7 | Conflicting `params` keys | `Conflicting value for Solr param "<key>"` |
| E8 | Unknown Solr namespace | `Unknown Solr namespace: <ns>` *(assertion, unchanged)* |
| — | Per-rule value errors (`numericRange`, `dateRange`, `regex`, `embeddingKnnSimilarity` model/format) | **unchanged verbatim** from the current implementation |

`buildSolrQuery([])` is **not** an error: it returns `{ query: '*:*', filter: [], params: {} }`. (This differs
from `filtersToSolr`, which throws on an empty list; that guard applies per-group and is retained internally.)

---

## 10. Test plan & acceptance criteria

Location: `test/unit/util/solr/queryBuilder.test.ts`, Mocha + `import { strict as assert } from 'assert'`,
no app boot, no fixtures. Assertions use `assert.deepStrictEqual` on the returned object.

### 10.1 Rule-level (one `describe` per rule)

For each of the 14 rules in §5.1, port every existing case from `test/unit/util/solr/reducers.test.ts` with
expectations rewritten to the JSON node shape, plus:

| # | Case | Expectation |
| - | ---- | ----------- |
| R1 | single value, single field | leaf string node |
| R2 | single value, multiple fields | `should` node with `minimum_should_match: 1` |
| R3 | multiple values, `op: 'OR'` | nested `should` node, one child per value |
| R4 | multiple values, `op: 'AND'` | `must` node, one child per value |
| R5 | `q` absent / `''` / `[]` / `['','']` | the rule's documented catch-all (`<field>:*`, `/.*/ `, `*`) |
| R6 | `prefix` field expansion | exact field list and order, incl. catch-all field |
| R7 | value escaping | parentheses, quotes, ID escaping (`Poseidon_$28$film$29$`), fully-escaped quotes |
| R8 | `precision` variants (`string` rule) | `exact`, `fuzzy`, `soft`, quoted-input, `~N` suffix — all four branches |
| R9 | date normalisation | year, year-month, ISO date, ISO datetime, array pair, array of ranges |
| R10 | malformed input | exact error message, per §9 |

### 10.2 Placement

| # | Case | Expectation |
| - | ---- | ----------- |
| P1 | only `scoring: false` filters | `query === '*:*'`, all nodes in `filter`, `params === {}` |
| P2 | only `scoring: true` filters | nothing in `filter`; single filter ⇒ `query` is the bare node, no redundant `bool` wrapper |
| P3 | mix of both | scored in `query.bool.must`, unscored in `filter`, order per §6.1 |
| P4 | empty `filters` array | `{ query: '*:*', filter: [], params: {} }` |
| P5 | two filters of the same type, same context | AND-ed as separate top-level `filter` entries / `must` children, not merged into one bool |
| P6 | determinism | building the same input twice yields deep-equal output; reordering input types reorders output correspondingly |
| P7 | node homogeneity (I1) | no emitted `bool` node contains both `must` and `should` |

### 10.3 Negation

| # | Case | Expectation |
| - | ---- | ----------- |
| N1 | single exclude, single value | `filter` contains `{bool:{must:['*:*'], must_not:[leaf]}}` |
| N2 | exclude with multiple values + another filter | the regression case of §6.3: negation groups the whole disjunction; `pets` does **not** escape the `NOT` |
| N3 | all filters excluded | `query === '*:*'`, single negation node in `filter`, invariant **I2** present |
| N4 | same type both included and excluded | two separate groups, include in its placement bucket, exclude in `must_not` |
| N5 | exclude on a `scoring: true` type | lands in `filter`'s negation node, not in `query` |
| N6 | `joinCollection` exclude | negation stays **inside** the join subquery; no outer `must_not` is produced (`handlesContext`) |

### 10.4 KNN / exclusive mode

| # | Case | Expectation |
| - | ---- | ----------- |
| K1 | KNN alone | `query` is the `knn` node; `filter === []`; `params.hl === false` |
| K2 | KNN + `scoring: false` filters | filters in `filter`, `query` still only the KNN node |
| K3 | KNN + `scoring: true` filters | the scoring filters are **moved into `filter`**; `query` is only the KNN node |
| K4 | KNN + excludes | negation node present in `filter` |
| K5 | two KNN filters | throws E6 with the exact message |
| K6 | topK parsing | third segment honoured; default `10` when absent; non-numeric segment ⇒ `10` |
| K7 | vector decoding | float32 precision preserved exactly (`0.1 → 0.10000000149011612`), negatives, single element, 10-element vector |
| K8 | unknown model | exact error message, listing the namespace's supported models |
| K9 | `hl` override | caller-supplied `hl: true` in a rule param is overridden to `false` |
| K10 | `images` vs `search` namespace | correct model→field map per namespace (`openclip-768`/`dinov2-1024` vs `gte-768`) |

### 10.5 Registry and validation

| # | Case | Expectation |
| - | ---- | ----------- |
| C1 | unknown filter type | throws E1 |
| C2 | registry entry with unknown rule | load-time validation throws E2 (tested against an injected registry object) |
| C3 | field shape mismatch | throws E3 |
| C4 | every type in every namespace of the shipped `solrFilters.yml` | builds without throwing when given a minimal valid filter — a smoke test that walks the real YAML |
| C5 | `scoring` defaults | a definition without `scoring` places its node in `filter` |
| C6 | `destination` is ignored | a definition with `destination: query` and no `scoring` still lands in `filter` |

### 10.6 params

| # | Case | Expectation |
| - | ---- | ----------- |
| M1 | no `orderBy` | `params === {}` |
| M2 | `orderBy` without `$topicRelevanceScore` | `params === {}` |
| M3 | `orderBy` with `$topicRelevanceScore` + topic filters | `topicRelevanceScore` is the `sum(payload(...))` string, IDs escaped |
| M4 | `orderBy` with `$topicRelevanceScore`, no topic filters | `topicRelevanceScore === '0'` |
| M5 | `extractVariables` enabled, long leaf | leaf replaced by `"$v0"`, value in `params.v0` |
| M6 | `extractVariables` disabled (default) | no `v*` keys |
| M7 | conflicting params | throws E7 |

### 10.7 Solr-level acceptance (integration, `test/integration/`)

Unit tests cannot prove the emitted JSON is *accepted* by Solr. Add integration coverage for:

| # | Case | Expectation |
| - | ---- | ----------- |
| S1 | one representative body per namespace | Solr returns HTTP 200, no parse error |
| S2 | invariant **I1** | a `must` + nested `should` body constrains the result set (the disjunction is not merely a boost) |
| S3 | invariant **I2** | a pure-negative filter returns the complement, not zero documents |
| S4 | `joinCollection` node | JSON-DSL `join` with `method=crossCollection` / `method=index` + `checkRouterField` behaves identically to the legacy `{!join …}` string form |
| S5 | KNN pre/post-filtering | resolves open item O2: with a highly selective filter, does the result count approach `topK` or collapse? |

### 10.8 Definition of done

1. All of §10.1–10.6 pass; §10.7 has been run at least once against a real Solr and its findings recorded in §11.
2. `solrFilters.yml` carries `scoring` per §4.3; the JSON schema is updated and types regenerated.
3. `NON_FILTERED_FIELDS`, `wrapAsFilter` and the `substr(4)` hack no longer exist in the codebase.
4. Every rule is reachable from the YAML and every YAML rule name resolves (C4 smoke test).
5. The behavioural change in §6.3 is documented in the release notes.

---

## 11. Open items

| ID | Item | Owner decision needed |
| -- | ---- | --------------------- |
| O1 | `joinCollection` exclude semantics: negation inside the join selects items in *another* collection rather than items *not* in the collection. Ported as-is. | Product — is the current behaviour intended? |
| O2 | KNN pre- vs post-filtering on the deployed Solr version. **Unverified.** Determines whether an explicit `preFilter` must be emitted (§7). | Verify empirically (S5) before landing |
| O3 | Whether Solr's JSON `bool` implicitly adds a match-all to pure-negative queries. The builder emits it explicitly regardless, so this is informational only. | None — belt and braces by design |
| O4 | `scoring: true` for `tr_passages.id`, `tr_passages.string`, `entities.string`, `images.title` (§4.3) — mechanical consequence of the old type-name-based list; may not be intended. | Product |
| O5 | `topK` derived from request `limit`/`offset` (existing TODO). Deliberately out of scope. | Later |
| O6 | Widening `SelectRequestBody.query` / `.filter` in `src/internalServices/simpleSolr.ts` to accept query nodes. Assumed, not verified. | Implementation prerequisite |
| O7 | Migration of existing callers of `filtersToQueryAndVariables` and removal of the old module. Out of scope for this round. | Later |
