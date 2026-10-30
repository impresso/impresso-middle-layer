# Signed delivery receipts

A valid receipt identifies the account to which Impresso issued it and, when
compared with an ID sequence, whether those IDs match the delivered membership
and order. Receipts can be removed or copied. Text, titles, transcripts and
other content inside items can be edited undetected. The signed sequence need
not be the full search result set. Receipts are an investigative lead, not proof
of who published data or that item content is authentic.

When `provenance.enabled` is true, authenticated public API `find` responses from
`content-items` and `search` include `meta.provenance = { token, kid }`, regardless
of transport. HTTP responses also include an `X-Impresso-Provenance` header.
Each page has its own receipt. Services marked as internal are excluded.
Signing errors fail covered deliveries. In webapp API mode, receipts are only
added to CSV downloads.

Search-results CSV exports include an always-last `impresso:provenance` column:
the first data row contains the token, and every subsequent cell is empty.
Successful nonempty exports are checked before ZIP creation, including on retries.
The receipt covers the rows actually exported, including any duplicates; it
cannot establish that batch processing delivered every matching search result.
Disabled provenance adds neither API receipts nor the CSV column.
Empty exports are exempt.

## Verification and local hashing

Authenticate with a normal API JWT. Verification is available in the Tools group
at `POST /tools/provenance`. Usually,
send the token alone:

```json
{ "token": "<paste meta.provenance.token or X-Impresso-Provenance here>" }
```

Authenticate with your normal API JWT, not the receipt token. Token-only requests
verify the signature and claims and return `{ valid: true, claims }` or
`{ valid: false, reason }`; they do not compare item IDs or return `idsMatch`.

For an optional ID-sequence comparison, supply exactly one of these inputs:

```json
{ "token": "<receipt>", "ids": ["item-a", "item-b"] }
```

```json
{ "token": "<receipt>", "csv": "id,text\nitem-a,title\nitem-b,other title\n" }
```

```json
{ "token": "<receipt>", "idsHash": "<lowercase SHA-256 hex>", "idsCount": 2 }
```

Valid receipts return `{ valid: true, claims, idsMatch? }`; invalid receipts return
`{ valid: false, reason }` without claims. `idsMatch` appears only with ID material
and compares both digest and count. A supplied `idsHash` checks only the client's
digest; it does not establish that the server examined the dataset. `ids` and
`csv` are examined server-side. The CSV must have unique headers, exactly one `id`
column, valid IDs and consistent row widths. The embedded CSV token is ignored;
keep the original token separately if you edit or remove rows.

The stable recipe is SHA-256 of the UTF-8 bytes of `ids.join("\n")`, in lowercase
hex, with no trailing newline. Use `data[].id` for both REST endpoints and `id`
for CSV. Every ID must be a nonempty string without CR or LF. Preserve delivered
order, duplicate occurrences, whitespace and Unicode exactly. An empty list
hashes the empty string. Removal, addition, substitution and reordering change
the digest; edits to other fields do not.

For a CSV, compute the hash and count locally with pandas:

```python
import hashlib
import pandas as pd

ids = pd.read_csv("export.csv", dtype=str, keep_default_na=False)["id"].tolist()
assert all(isinstance(i, str) and i and "\r" not in i and "\n" not in i for i in ids)
print(hashlib.sha256("\n".join(ids).encode("utf-8")).hexdigest(), len(ids))
```

Verification is performed server-side; the API does not publish a key registry.
Receipts have no expiration. Provenance receipts cannot authenticate API calls.

Limits: token 16 KiB, ID array 100,000 entries, each ID 4,096 characters, CSV
1 MiB UTF-8 and total JSON HTTP body 2 MiB. Malformed input returns 422; oversized
HTTP JSON returns 413. Hash locally for larger exports.

## Keys and operations

Receipts use HS256 with a dedicated 32-byte signing key derived from
`authentication.secret` using HKDF-SHA256. The derivation uses salt
`impresso-middle-layer` and info `provenance-watermark:v1`. The auth secret is
never used directly to sign receipts. There are no separate RSA keys or
ephemeral development keys to configure or retain.

Configure provenance alongside your existing authentication configuration:

```json
{
  "provenance": {
    "enabled": true,
    "issuer": "impresso-middle-layer",
    "audience": "provenance",
    "findServices": ["content-items", "search"]
  }
}
```

The default is disabled when the block is absent. Enabled configurations require
a nonempty `authentication.secret` and an explicit authentication audience
distinct from provenance (including the web-app authentication audience).
The derived key and its ID are identical across restarts with the same auth
secret, in both development and production. The ID is `hkdf-sha256-v1-` followed
by the SHA-256 hex fingerprint of the derived key. Instances issuing and
verifying the same receipts must use the same auth secret, or retain the issuing
instance's secret for verification.

When rotating `authentication.secret`, retain the previous value in
`provenance.previousAuthSecrets` to verify archival receipts:

```json
"previousAuthSecrets": ["${PREVIOUS_AUTH_SECRET}"]
```

Historical secrets are used only for receipt verification, never for signing
new receipts or authenticating API calls. Store them securely with the other
auth secrets; environment references use the existing configuration loader.
Losing an old auth secret makes its receipts unverifiable. Authentication-secret
compromise also compromises provenance. Keep verification and historical secrets
available even if delivery receipts are disabled. Persisted export job
`extra.provenance` contains `kid`, `idsHash` and `idsCount`.

This format replaces the earlier RS256 design. Remove `privateKey`, `publicKeys`,
and `activeKid` from provenance configuration. Earlier RSA receipts are not
accepted by the HS256 verifier.

Resolve `claims.userRef` against the immutable `users.uid`; export `jobs.creatorId`
corroborates the account association. Receipts can outlive export rows. Retain
the UID/account and audit association for as long as receipts may need resolution;
do not hard-delete those associations during that period. Soft-delete or
anonymize personal fields consistently with existing account handling while
retaining the immutable UID. This is an operations retention requirement, not an
automated change to account deletion behavior.

## Terms-of-use note

Delivery receipts record which account received an item-ID sequence. They are
an investigative lead only: they do not prove who later published the dataset,
the authenticity of item content, or search-result completeness. Receipts can
be removed or copied; `idsMatch` attests only to membership and order relative
to the originally signed sequence. This note must accompany partner-facing
receipt descriptions and any terms-of-use text describing provenance.
