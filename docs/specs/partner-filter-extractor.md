# Legacy Partner Filter Extractor

Status: planned (2026-10-30).

## Goal

Make `/filters-items` resolve the selected values of a legacy partner filter:

```json
{ "type": "partner" }
```

Instead of returning the fallback `{ "id": "…" }` values, the service must
return the matching `Partner` items, including their human-readable titles.

## Context

`partner` is a legacy filter whose Solr facet is `meta_partnerid_s`
(`src/data/constants.ts`). Its filter values are partner-institution IDs from
the partner institutions directory loaded at application startup.

The required lookup already exists:

```
filters-items extractor
        │
        ▼
buildResolvers(app).partner(id)
        │
        ▼
src/internalServices/facetResolvers/partnerResolver.ts
        │
        ▼
getPartnerInstitutionsDirectory(app)
```

`partnerResolver.ts` converts directory entries into the generated legacy
`Partner` shape:

```ts
{ id: entry.partner_institution_id, title: preferredName }
```

`preferredName` is the English name when available, otherwise the first listed
name, otherwise the partner ID. The resolver memoizes the ID-to-partner map in
process memory and returns `undefined` for an unknown ID.

## Scope

### 1. Add the extractor

In `src/services/filters-items/extractors.ts`, export a
`partnerExtractor`. It must use the existing generic `resolveItems` helper and
the existing cached resolver:

```ts
export const partnerExtractor = async ({ q = '' }: WithQ, app: ImpressoApplication) =>
  resolveItems(q, app, (resolvers, item) => resolvers.partner(item))
```

This gives the filter the same behavior as the topic, year, image-type, and
special-membership extractors:

- accept either a single `q` string or an array of IDs;
- trim each submitted ID before lookup;
- preserve the input order of resolved IDs;
- omit IDs which the resolver cannot find; and
- return the existing `Partner` contract (`id`, `title`, optional `url`).

No resolver, cache, directory-loading, Solr, or schema change is required.

### 2. Register it for `partner`

In `src/services/filters-items/filters-items.class.ts`:

1. import `partnerExtractor` from `./extractors.js`;
2. add `partner: partnerExtractor` to `ItemsExtractors`.

This registration is required because unregistered filter types currently use
`simpleValueExtractor`, which only wraps submitted values in `{ id }` objects.

## Explicit non-use of `DataProvider`

Do **not** use `DataProvider`, the `/data-providers` service, or
`src/services/data-providers/data-providers.class.ts` for this work. Although
that interface is available and is also sourced from the partner institutions
directory, it is not the contract of this legacy filter.

The `partner` filter must continue to resolve through
`src/internalServices/facetResolvers/partnerResolver.ts` and return `Partner`,
not `DataProvider`. In particular, the response must not add `names` or
`bitmapIndex`, and it must retain the resolver's title-selection behavior.

## Tests

Follow `.github/agents/feathers-service-tests.agent.md` when adding these
tests. In particular, start from the existing filters-items test files, use
Mocha with `import { strict as assert } from 'assert'`, and construct the app
with `setupTestApp(...)`; do not hand-roll an `ImpressoApplication` mock.

Extend `test/unit/services/filters-items/extractors.test.ts` with focused
`partnerExtractor` tests. The extractor needs only the loaded directory, so
build the narrowest app surface with:

```ts
setupTestApp(withCachedResolverServices(), withConfig('partnerInstitutionsDirectory', partnerDirectory))
```

`partnerDirectory` must be a small inline, typed
`PartnerInstitutionsDirectory` fixture with fixed IDs and names. No Sequelize,
Redis, Solr, or queue fixture is required. `buildResolvers` eagerly requests
the `collections`, `media-sources`, and `special-membership-plans` service
handles even though the partner path does not call them; provide those empty
handles through `withCachedResolverServices()`. The partner resolver itself
reads only `app.get('partnerInstitutionsDirectory')`. `setupTestApp` will fail
on any other unexpected service lookup, which is the desired guard.

Cover the following cases:

1. A single partner ID resolves to `{ id, title }`.
2. An array containing surrounding whitespace resolves in submitted order.
3. An English name is preferred over another localized name; if no English name
   exists, the first name is used.
4. Unknown IDs are omitted rather than returned as simple `{ id }` values.

Extend `test/unit/services/filters-items/filters-items.class.test.ts` with an
integration-at-the-service-boundary test for a `Filter` whose `type` is
`partner`. Build this test's `FiltersItems` instance using a separate
`setupTestApp(withCachedResolverServices(), withConfig(...))` app (and call
`await testApp.teardown()`),
rather than adding a database or unrelated dependency to the partner case.
Assert that `FiltersItems.find()` returns the full resolved partner item. This
verifies that the extractor is registered and that the fallback extractor is
no longer used.

The partner resolver has a module-level cache. Tests that supply distinct
directory fixtures must avoid sharing a process-level resolver cache across
fixtures (for example, use one directory fixture for all partner assertions,
or expose/reset cache state only if that becomes necessary). Do not alter
production cache semantics merely to support the tests.

Keep each assertion in a focused `it(...)` block, use direct assertions on the
returned values, and remove unused imports. The changed behavior has both a
success case (a resolved partner) and a failure case (an unknown partner is
omitted), as required by the test guidance.

## Verification

Run:

```bash
npx mocha test/unit/services/filters-items/extractors.test.ts
npx mocha test/unit/services/filters-items/filters-items.class.test.ts
npm run lint
```

Expected behavior for:

```json
{
  "filters": [
    { "type": "partner", "context": "include", "q": ["partner-a", "partner-b"] }
  ]
}
```

is one `filtersWithItems` entry retaining the original filter and returning:

```json
{
  "items": [
    { "id": "partner-a", "title": "Partner A" },
    { "id": "partner-b", "title": "Partner B" }
  ]
}
```

where titles are the values resolved from the loaded partner institutions
directory.

## Out of scope

- Replacing or deprecating the `partner` filter.
- Changing the partner institutions directory, its startup fetch, or its
  process-local cache.
- Changing the `Partner` schema or generated types.
- Exposing `DataProvider` fields through legacy partner-filter responses.
- Changing Solr faceting or query construction for `meta_partnerid_s`.
