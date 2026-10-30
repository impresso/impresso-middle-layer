# Signed Delivery Receipts with Item-Set Integrity (Provenance Watermark v1)

Status: implemented (2026-10-08), revised after review rounds 1–3 + item-set hashing

## Goal

Bind each covered dataset delivery to the account that received it, and make
the **delivered item set verifiable**, using an overt, signed receipt. The
receipt records *which account received* an export or API response and a hash
of the **ordered content-item ID list** it contained. It **cannot establish who
later published the data**, and it does not attest the *content* of the items —
only that the item set (membership + order) is unchanged.

> **Limitation:**
> A valid receipt identifies the account to which Impresso issued it, and —
> compared against the originally signed ID sequence — that the delivered items
> are exactly the ones that were exported, in the same order. Receipts can be
> removed or copied, text **inside** items can be edited undetected, and the
> signed sequence itself may not equal the full result set, so receipts are an
> investigative lead and an ID-sequence comparison, not proof of who published
> data or that item content is authentic.

## Agreed scope

| Area | Decision |
| --- | --- |
| Coverage | **Content-item lists only**: the CSV/zip search-results export and the `find` endpoints that return content-item lists (default: `content-items`, `search`). Other endpoints are not watermarked. |
| CSV/zip bulk export | Dedicated `impresso:provenance` **column**; the receipt token is carried in the **first data row**. Default and only CSV mechanism — no separate CSV flag; the shared `provenance.enabled` switch governs both API and CSV receipts. No manifest file, no download header. |
| API JSON responses | In public API mode, `find` on covered endpoints gets a `meta.provenance` block regardless of transport. HTTP responses also get an `X-Impresso-Provenance` response header. In webapp API mode, provenance applies only to CSV downloads. |
| Integrity (v1) | **Item-set hashing**: `idsHash` = deterministic hash over the ordered content-item IDs. Verifiable by recomputation. Full content hashing (transcripts etc.) remains **out of scope**; no result may imply item *content* is authentic. |
| Covert/steganographic marking | **Rejected** — data is consumed programmatically; added friction is not acceptable. |
| Verification service | Yes — validates the receipt and, given an ID list / hash / CSV, recomputes `idsHash` and reports whether the item set matches. |

## Design

### Receipt = HS256 JWT, minimal claims

Signed with the existing `jsonwebtoken` dependency (no new dependency) using a
**dedicated derived signing key** from `authentication.secret`. Use HKDF-SHA256
with salt `impresso-middle-layer`, info `provenance-watermark:v1`, and output
length 32 bytes. The raw auth secret must never sign provenance receipts.

JWT header: `{ alg: "HS256", kid: "hkdf-sha256-v1-<sha256-derived-key-hex>" }`
(`kid` lives in the header, not the payload). The key and its fingerprint are
deterministic across restarts with the same authentication secret.

Payload — kept deliberately small:

```jsonc
{
  iss: "impresso-middle-layer",   // provenance issuer
  aud: "provenance",              // dedicated audience
  iat: <issued-at>,
  jti: "<receipt id>",
  userRef: "<user uid>",          // opaque internal label, no PII/email
  kind: "api" | "export",
  exportId: "<export id>",        // export receipts only
  path: "<service path>",         // api receipts only
  idsHash: "<sha256 hex>",        // hash over the ordered item IDs (see recipe)
  idsCount: <n>                   // number of items covered
}
```

- **No `exp`** — receipts are archival and must stay verifiable for years;
  previous authentication secrets are retained for verification after rotation.
- `idsHash` is computed at mint time: for API receipts from the response's
  ordered IDs (the token never lives inside `data`, so this is not circular);
  for export receipts in a **finalization pass** once the completed CSV's ID
  column is known (see below).

### Item-set hash recipe (public, stable)

```
idsHash = sha256( ids.join("\n") )   // lowercase hex; ids as delivered, in order
```

Permitted ID values and canonical rules — hashing **fails** (it never skips)
if any of these is violated:

- every ID is a nonempty string containing no CR (`\r`) and no LF (`\n`),
- IDs are taken exactly as delivered: UTF-8, no trimming, no normalization,
  no added trailing newline,
- original order **and duplicate occurrences** are preserved (the sequence,
  not a set, is hashed).

The ID field is **`data[].id` for both covered endpoints**: `search.find()`
delegates to `content-items.find()`, so both share the same identifier field.

Empty list → sha256 of the empty string; `idsCount: 0`.

The recipe is published so researchers can recompute `idsHash` locally
(one-liner in pandas/shell) without uploading data.

Detects: removals, additions, substitutions, reordering — i.e. any change to
the ID sequence. Does **not** detect edits inside item content (titles,
transcripts, enrichments).

### Strict verification rules

- Algorithm pinned to `HS256` (reject `alg` confusion attacks).
- `kid` must match the key derived from the current authentication secret or
  one of `provenance.previousAuthSecrets`.
- `iss`/`aud` must match the provenance issuer/audience.
- Required claims: `iat` must be numeric; `jti` and `userRef` must be nonempty
  strings; `idsHash` must be a lowercase 64-char hex string and `idsCount` a
  nonnegative integer; `kind` must be `api` or `export` with:
  - `kind: "export"` → `exportId` must be a nonempty string, `path` absent,
  - `kind: "api"` → `path` must be a nonempty string, `exportId` absent.
- Result shape: `{ valid: true, claims, idsMatch?: boolean }` or
  `{ valid: false, reason }` — verified claims are only exposed for valid
  receipts. `idsMatch` is present only when ID material was supplied.

### Authentication isolation (explicit requirement)

Domain-separated derived provenance keys and a distinct audience (`provenance` ≠
`authentication.jwtOptions.audience`) are necessary but **not sufficient by
themselves**: isolation only holds if *both* verifiers enforce it. This plan
therefore treats it as a tested requirement, not an implication:

- the provenance verifier rejects tokens issued for the API audience, and
- **the API authentication must reject provenance receipts** (audience check on
  the authentication side) — covered by a dedicated test.

### Authentication-secret derivation and rotation

The active key is always derived from `authentication.secret`, without storing
separate key material. Development and production use the same derivation;
there is no ephemeral-key fallback. When enabled, missing or empty auth secrets
fail startup. Instances that share receipts must share the issuing auth secret
or retain it for verification.

On auth-secret rotation, retain previous values in the optional
`provenance.previousAuthSecrets` array. These secrets are used only to verify
archival receipts, not to sign new ones or authenticate API requests. Losing
a historical auth secret makes its receipts unverifiable. A compromised auth
secret compromises the corresponding provenance receipts too.

This replaces the dedicated RSA-key requirement. The old `privateKey`,
`activeKid`, and `publicKeys` configuration fields and RS256 receipts are no
longer supported.

### Account reference resolution

`userRef` is the **existing immutable user UID** (no hashing, no aliases): it is
stable for the account's lifetime and directly resolvable via the `users` table
(`uid`), with the `jobs.creatorId` association as corroboration for exports.
Long-term tracing depends on retaining this association, so the ops
documentation must state the account lookup path and the account/audit
retention policy (receipts outlive individual export rows, so user records must
not be hard-deleted while receipts may need resolution — soft-delete/anonymize
consistent with existing user handling).

### Delivery behavior (explicit)

- API: when provenance is enabled for a covered service, a signing failure
  **fails that response** (5xx) rather than silently returning unmarked data.
- Export: signing failure fails the export job; additionally, **when provenance
  is enabled, every successful nonempty export must pass the pre-publish
  receipt check** — a successful ZIP always contains a valid export receipt,
  including after retries. (Empty exports write no rows and stay exempt;
  disabling `provenance.enabled` disables receipts entirely.)
- The promise is limited to the listed services and CSV exports; nothing
  else is watermarked.

### API/JSON (covered `find` endpoints only)

- App-level `after.find` hook: computes `idsHash`/`idsCount` from the
  response's ordered item IDs, mints the receipt, adds
  `result.meta.provenance = { token, kid }` and sets
  `context.http.headers['X-Impresso-Provenance']` (same mechanism as
  `src/hooks/rateLimiter.ts`).
- Applies only when: public API mode, provenance enabled, response has `{ data, pagination }`
  shape, `params.user` present, the service is not marked as internal, and the
  service path is in the configured allowlist (default: `content-items`,
  `search`). No transport/provider restriction applies.
- The token never enters `data`, so hashing the delivered ID order is safe.

### CSV/zip export

- In `src/jobs/searchResults/exportSearchResults.ts`, the CSV gains one extra,
  always-last column **`impresso:provenance`**:
  - the header row (written by the first batch that has rows, as today)
    includes the column,
  - row 1's cell starts **empty**; the token is inserted by the finalization
    pass (below); all other rows keep an empty cell. The CSV stays
    rectangular — no ragged trailer rows, safe for programmatic consumers
    (pandas, R, Voyant).
- **Finalization pass** (once the last batch is appended, `idsHash` becomes
  computable):
  1. hash the ID column **incrementally**: stream `csv-parse` over the file,
     feed each ID into the SHA-256 state and increment a counter — the full
     list is never retained in memory,
  2. mint the export receipt,
  3. insert the token **atomically and repeatably**: stream-parse the original
     CSV and re-serialize the records with the existing serializer
     (`csv-stringify`, same options) into a temporary file, writing the token
     into row 1's `impresso:provenance` cell; on success `rename` the
     temporary file over the original; on any failure, leave the original
     untouched and fail the export. No custom byte scanner; repeated
     finalization is safe. Re-serialization is acceptable because only IDs
     are hashed.
- **Pre-publish receipt check**: before the ZIP is created, re-read the header
  and first logical record of the **finalized** file via `csv-parse` (stops
  after one record; safe for quoted commas/newlines), verify the token —
  signature, `kind: "export"`, `exportId` matching the current export,
  `claims.userRef === job.data.userUid`, and recompute `idsHash`/`idsCount`
  from the file's ID column and compare. The export fails otherwise. When
  enabled, this guarantees every successful nonempty export carries a valid,
  item-set-bound receipt — after retries too.
- **Scope of the guarantee**: the receipt covers the sequence actually
  exported; it does **not** prove that the export contains every matching
  search result or that batch processing was error-free (rows appended or
  duplicated before signing would be signed as-is).
- Empty exports (0 results): no data row is written today, so nothing is
  marked; behavior unchanged.
- Zip packaging (`createZipArchive`) and the download endpoint
  (`src/services/media.ts`) are unchanged.

### Verification service `/tools/provenance`

New service `src/services/provenance/` (authenticated, JWT):

- Verification is server-side only, via `POST /tools/provenance` in the Tools group.
  There is no GET endpoint or published key registry.
- `create()` — one input contract:
  - `token` is **required**. ID material is either absent (signature/claims
    check only) or **exactly one** of:
    - `{ ids: [...] }` — server recomputes `idsHash` **and** `idsCount`;
      **both** must match the receipt,
    - `{ csv }` — server extracts the ordered `id` column and recomputes both,
      same comparison,
    - `{ idsHash }` — must be accompanied by the client-supplied `idsCount`;
      both are compared against the receipt.
  - CSV input rules: the file must contain **exactly one `id` column**;
    malformed CSV, missing IDs, or duplicate headers → **422**. The receipt
    embedded in row 1 is **ignored** — the supplied `token` is authoritative.
  - Result: `{ valid, claims, idsMatch? }` / `{ valid: false, reason }`;
    `idsMatch` is present only when ID material was supplied and reports
    whether the ID sequence matches. `idsMatch` covers item
    membership/order only — **not** the content of the items.
  - Documented distinction: a client-supplied `idsHash` only verifies the
    supplied digest; it does **not** establish that the server examined the
    dataset. Only `ids`/`csv` inputs are examined server-side.

## Implementation steps

### 1. Config

- Add `provenance` block to `src/schema/app/configuration/config.json`:
  `{ enabled: bool, issuer: string, audience: string, previousAuthSecrets?: string[],
     findServices?: string[] }` (default `["content-items", "search"]`).
- Update `src/configuration.ts` (`Configuration` interface) and regenerate
  generated types (`npm run generate-types` → `src/models/generated/app/configuration.d.ts`).
- Derive the current signing key from the existing `authentication.secret`.
  Optional previous auth secrets use the existing environment-reference loader.
  No separate keys, configured key IDs, or development fallback are required.

### 2. Core util — `src/util/provenance.ts` (new)

- `createReceipt(claims, app)` → compact JWT (HS256, derived `kid` header).
- `verifyReceipt(token, app)` → `{ valid, claims?, reason? }` with the strict
  rules above.
- `idsHash(ids: string[])` → recipe implementation (public, documented);
  validates the ID rules and **fails** on invalid IDs (CR/LF, empty) instead
  of skipping.
- `csvIdsHashStream(path)` → streaming extraction of the ordered `id` column:
  updates SHA-256 incrementally and maintains a counter; never retains the
  full list in memory.
- `finalizeCsvWithToken(filePath, token)` → atomic finalization primitive:
  stream-parse → re-serialize records with `csv-stringify` (same options)
  into a temporary file with the token in row 1's provenance cell → `rename`
  over the original; original untouched on failure; safe to re-run.
- Unit-testable without an app: pass `{ provenance: config, authSecret }`.

### 3. Response schema — `meta` block

- `src/schema/app/responses/BaseFind.json`: add optional
  `meta: { additionalProperties: false, properties: { provenance: { token, kid } } }`
  (currently `additionalProperties: false` — without this change public-API
  response validation rejects watermarked responses).
- Audit service-level find-response schemas with `additionalProperties: false`
  (e.g. `FindTextReuseClustersResponse.json`) and add `meta` there too.
- `npm run generate-types`; `PublicFindResponse` in `src/models/common.ts`
  picks up `meta` automatically; fix any narrowed types.

### 4. After-find hook — `src/hooks/provenance.ts` (new)

- Reads config + allowlist; computes `idsHash` from `result.data` IDs (id field
  pinned per service); mints receipt; sets `result.meta` and
  `context.http.headers`.
- Register in the app-level hooks in `src/app.hooks.ts` (`after: { find: [...] }`);
  skip internal services (`context.service.isInternalService`) and paths
  outside the allowlist (default `content-items`, `search`).
- Failure mode: on signing errors, **propagate the error** (fail the response)
  for covered routes, per the delivery-behavior decision.

### 5. Export job — `src/jobs/searchResults/exportSearchResults.ts`

- Extend `appendItemsToCSV` (or its call site) so `impresso:provenance` is the
  last column of every batch; row 1's cell is written empty (token arrives at
  finalization). Ensure the always-present column keeps header and row shapes
  consistent across chained batches.
- **Finalization** in the completion branch: `csvIdsHashStream` → mint export
  receipt (`userId/userUid`, `exportId`, `idsHash`, `idsCount`) →
  `finalizeCsvWithToken` (atomic temp-file rewrite + rename) → **pre-publish
  check** (re-read row 1 via `csv-parse`; verify signature, `kind: "export"`,
  `exportId`, `userRef === job.data.userUid`, and `idsHash`/`idsCount` against
  a fresh incremental pass over the finalized file) before `createZipArchive`;
  throw (job fails) on any mismatch or absence.
- Persist `kid` (+ `idsHash`) in the job record `extra` for server-side lookup.

### 6. Verification service — `src/services/provenance/`

- `provenance.class.ts`, `provenance.service.ts`, `provenance.hooks.ts`,
  `provenance.schema.ts` (JSON schema for input/output; follow AGENTS.md
  Feathers v5 + ESM patterns, `@/` imports).
- Register in `src/services/index.ts` public list (authenticated via
  `authenticate('jwt')` hook).
- `create()` guards: token size cap; `ids` array size cap (count + per-ID
  length); `csv` HTTP body cap — the JSON body is buffered before parsing, so
  the cap is enforced on the buffered body (oversized → 413/422); full
  streaming upload infrastructure is not required. Per-ID values are validated
  against the recipe rules (nonempty, no CR/LF) and violations → 422, matching
  the hashing contract.
- Add `csv-parse` dependency (companion of the already-used `csv-stringify`).
- Run `npm run generate-types` afterwards for the new response schema, and
  `npm run lint-api-spec` against a running dev server.

### 7. Tests (`test/unit/…`, Mocha + `assert` strict, minimal mocks)

- `util/provenance.test.ts` — sign/verify roundtrip; rejects: wrong algorithm
  (`HS384` forgery attempt), raw-auth-secret signatures, unknown `kid`, wrong `iss`/`aud`, missing/invalid
  `iat`/`jti`/`userRef`/`idsHash`/`idsCount`, kind/identifier mismatches
  (export with `path`, api with `exportId`), tampered payload; invalid tokens
  never return `claims`. Hash recipe: stable, order-sensitive, duplicates
  preserved (hash of `["a","a"]` ≠ `["a"]`), empty-input case, **IDs
  containing CR/LF or empty → hashing fails**. Finalization: first record
  with quoted commas + embedded newlines survives the temp-file rewrite;
  token verifiable after; **interrupted finalization leaves the original
  intact; repeated finalization is idempotent**.
- `hooks/provenance.test.ts` — meta + HTTP header metadata added for allowlisted
  find with user across REST, Socket.io, and providerless calls; `idsHash`
  matches the response's ordered IDs; skipped in webapp API mode or when disabled / unauthenticated /
  non-covered path / internal service / nonpaginated response;
  signing failure fails the response.
- **Auth isolation test** — a valid provenance receipt is **rejected by API
  authentication** (`app.service('authentication')`), and an API JWT fails
  receipt verification.
- `jobs/exportSearchResults.watermark.test.ts` — header contains
  `impresso:provenance`; after finalization row 1 carries a verifiable token
  with `idsHash`/`idsCount` matching the file's ID column; subsequent rows
  have an empty cell; rectangular shape preserved; pre-publish check fails
  the job when the token is missing, has a foreign `exportId`, `userRef`
  differs, IDs were altered, or the **count mismatches** (partial mocks per
  repo conventions).
- `services/provenance.test.ts` — `create()`: valid token → `{valid: true, claims}`; with `ids`/`idsHash`+`idsCount`/`csv`
  → correct `idsMatch` (match, removal, reorder, addition, **count
  mismatch**, duplicate IDs preserved); CSV with missing/`duplicate` `id`
  headers or malformed rows → 422; embedded row-1 receipt ignored when it
  differs from `token`; invalid token → `{valid: false, reason}` without
  `claims`; malformed input → 422.

### 8. Docs & ops

- Publish the hash recipe (idsHash definition, per-endpoint ID field) in the
  API docs.
- Document auth-secret derivation and historical secret retention in the config example.
- State the delivery-receipt limitation (quote at top) in user-facing docs and
  the ToS note; `idsMatch` covers item set only, not item content.

## Verification

- `npm run typecheck && npm run lint && npm test`
- Manual: start dev server, `curl -i` content-items find →
  `X-Impresso-Provenance` header + `meta.provenance` in body; run an export →
  open the CSV → `impresso:provenance` last column, token in row 1; save the
  token separately, then remove a row or reorder → `POST /tools/provenance` with
  `{ token, csv }` (the endpoint requires the token and ignores the embedded
  row-1 receipt) → `idsMatch: false`; unchanged CSV + token →
  `idsMatch: true`; token with wrong `aud`/`kid` → `{valid: false}`.

## Risks / open points

- Public-API response validation: any find schema missing the `meta` addition
  will 422 — covered by step 3 audit + lint-api-spec.
- The finalization rewrite is the most delicate piece; the atomic
  temp-file + rename approach removes byte-splicing hazards, and the result
  is validated again by the pre-publish check before the ZIP ships.
- The receipt covers the **actually exported** ID sequence: rows lost or
  duplicated by batch processing before signing would be signed as-is — it is
  a comparison against the originally signed sequence, not a guarantee of
  search-result completeness.
- Item-set hashing detects ID-sequence changes only; in-item content edits
  are undetectable — messaging must be precise (top quote).
- `userRef` is the immutable user UID; tracing depends on retaining the
  account record — document the lookup path (`users.uid`, `jobs.creatorId`)
  and retention policy in ops docs (see "Account reference resolution").
- API receipts are response-bound (`idsHash` over delivered IDs): clients
  that page/aggregate will hold receipts per response; this is intended.
- Key rotation is manual: add new active key, retain old public keys so
  archival receipts stay verifiable.
- Receipts are attribution/deterrence, not DRM — communicated to the partner as
  such.
