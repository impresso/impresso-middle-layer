# Special Membership Plans Reviewer Access

Status: implemented (2026-11-18).

## Goal

Let an authenticated user check which special membership plans they have access
to as reviewer:

```http
GET /special-membership-plans?asReviewer=true
Authorization: Bearer <jwt>
```

must return only the plans whose `reviewerId` is the authenticated user's id,
using the existing `find` response shape (`PublicFindResponse<SpecialMembershipAccess>`).

## Context

The reviewer relationship already exists in the data model
(`SpecialMembershipAccess.reviewerId`, column `reviewer_id` in
`impresso_datasetbitmapposition`) and is already enforced for writes: the
`patch` method of `/special-membership-plans` rejects anyone who is not the
plan's reviewer. What is missing is discovery: there is currently no way to
list "the plans I review".

The closest existing endpoint, `/user-special-membership-requests-reviews`,
is reviewer-scoped but operates on **requests**, not plans:

- plans with zero requests never appear there;
- it paginates over requests, so the plan list would be incomplete and
  indirect;
- it returns request objects, not plan objects.

Current `find` behavior of `/special-membership-plans`
(`special-membership-plans.class.ts`):

1. unauthenticated: paginated list of all plans;
2. authenticated: same list, with the caller's own requests attached to each
   plan (`requests` include filtered by `userId`, `required: false`);
3. optional `bitmapPositions` filter on the main `where` clause.

An important hook-ordering constraint: `queryWithCommonParams()` (see
`src/hooks/params.ts`) **replaces** `context.params.query` with
`{ ...context.params.sanitized, limit, offset }`. Custom query parameters must
therefore be validated into `context.params.sanitized` **before**
`queryWithCommonParams()` runs — this is exactly what
`validateBitmapPositionsQuery()` does today, and `asReviewer` must follow the
same pattern.

The service is disabled in public API mode (`optionsDisabledInPublicApi`), so
no OpenAPI schema is required for this change.

## Scope

### 1. Add the `asReviewer` query parameter

Add `asReviewer?: boolean` to `FindQuery` in
`special-membership-plans.class.ts`.

When `asReviewer === true`, `find()` must:

1. require an authenticated user: if `params?.user?.id` is missing or `NaN`,
   throw `NotAuthenticated`. Do **not** silently fall back to the anonymous
   list and do **not** return an empty result — an expired JWT must not
   masquerade as "nothing to review";
2. add `reviewerId: userId` to the main `where` clause, composed with (AND)
   the existing `bitmapPositions` filter when present:
   ```ts
   const where = {
     reviewerId: userId,
     ...(Array.isArray(bitmapPositions) && bitmapPositions.length > 0
       ? { bitmapPosition: { [Op.in]: bitmapPositions } }
       : {}),
   }
   ```
3. keep the existing `requests` include semantics (the caller's own requests
   only) so the response shape is unchanged; plan-with-zero-of-my-requests
   still appears, with an empty `requests` array.

When `asReviewer` is `false` or absent, behavior must remain identical to
today (all three current modes above).

Plans with `reviewerId = null` must never appear in `asReviewer` results.

### 2. Add the `validateAsReviewerQuery` hook

In `special-membership-plans.hooks.ts`, add a `validateAsReviewerQuery()`
hook modeled on `validateBitmapPositionsQuery()`:

- read `context.params?.query?.asReviewer`; pass through when `null` or
  `undefined`;
- accept booleans and the strings `'true'`, `'false'`, `'1'`, `'0'` (query
  params arrive as strings over REST);
- normalize to a boolean and store it in `context.params.sanitized.asReviewer`
  (create `context.params.sanitized` if missing);
- throw `BadRequest` with message
  `` `asReviewer` must be a boolean ("true" or "false") `` for any other
  value.

### 3. Register the hook

In the default hooks export, extend the `find` chain:

```ts
before: {
  find: [validateBitmapPositionsQuery(), validateAsReviewerQuery(), queryWithCommonParams()],
  patch: [validatePatchMetadata()],
},
```

`queryWithCommonParams()` must stay **last**: it rebuilds
`context.params.query` from `sanitized` plus pagination, which is how
`bitmapPositions` survives today.

Also export `validateAsReviewerQuery` from
`special-membership-plans.service.ts` alongside the two existing hook
exports, so tests can import it the same way.

## Response contract

```json
{
  "pagination": { "limit": 10, "offset": 0, "total": 2 },
  "data": [
    {
      "id": 3,
      "reviewerId": 1,
      "title": "Plan 3",
      "bitmapPosition": 3,
      "metadata": { "modality": "cc_reviewer" },
      "requests": []
    }
  ]
}
```

`total` reflects the reviewer filter. Default pagination applies
(`limit=10`, `offset=0`, max 1000 via `queryWithCommonParams`).

Error cases:

| Condition | Result |
| --- | --- |
| `asReviewer=true` without authentication | `NotAuthenticated` (401) |
| `asReviewer=banana` (or any non-boolean value) | `BadRequest` (400) |
| authenticated user reviews no plans | `200` with `data: []`, `total: 0` |

## Tests

Extend `test/unit/services/special-membership-plans/special-membership-plans.test.ts`
(Sequelize-backed suite, `setupTestApp(withDatabase(), withCacheManager())`).
Seed `SpecialMembershipAccess` records with mixed `reviewerId` values
(including `null` and another user's id) plus `UserSpecialMembershipRequest`
rows where useful.

Cover:

1. `validateAsReviewerQuery`:
   - accepts `'true'`, `'false'`, `'1'`, `'0'` and booleans, normalizing into
     `params.sanitized.asReviewer`;
   - throws `BadRequest` with the exact message for `'banana'`, `''`, `'2'`;
   - passes through when the parameter is absent.
2. `find({ query: { asReviewer: true }, user })`:
   - returns only plans with `reviewerId === user.id`;
   - excludes plans with `reviewerId = null` and other users' plans;
   - `pagination.total` matches the filtered count;
   - composes with `bitmapPositions` (AND semantics);
   - pagination (`limit`/`offset`) applies to the filtered set.
3. `find({ query: { asReviewer: true } })` without a user throws
   `NotAuthenticated`.
4. `find({ query: { asReviewer: false }, user })` and plain
   `find({ user })` keep the current behavior (all plans, my requests
   attached).

Use direct assertions on returned values and exact thrown errors; follow the
existing test file conventions (`import { strict as assert } from 'assert'`).

## Verification

```bash
npx mocha test/unit/services/special-membership-plans/special-membership-plans.test.ts
npm run lint
```

Manual check against a dev database:

```bash
curl -H "Authorization: Bearer <jwt>" "http://localhost:3030/special-membership-plans?asReviewer=true"
```

## Out of scope

- Attaching **all** requests (not just the caller's) to each plan; reviewer
  request listing is already covered by `/user-special-membership-requests-reviews`.
- Counting pending requests per plan.
- Changing `patch` authorization or any write path.
- Public API exposure or OpenAPI schema (service is disabled in public API
  mode).
- Changing the model, cache, or well-known cache entries.

## Rejected alternative

A dedicated service (e.g. `GET /special-membership-plans-reviews`, mirroring
`user-special-membership-requests-reviews`) was considered and rejected:
`asReviewer` is a filter over the same entity with the same response shape,
not a new resource. A separate service would duplicate registration, hooks
and pagination, and would not compose with the existing `bitmapPositions`
filter.
