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

Use a dedicated RSA keypair, separate from authentication keys. Generate it once
and store it securely; do not commit private keys:

```sh
openssl genrsa -out provenance-private.pem 3072
openssl rsa -in provenance-private.pem -pubout -out provenance-public.pem
```

Supply PEM values (actual multiline strings) as `PROVENANCE_PRIVATE_KEY` and
`PROVENANCE_PUBLIC_KEY_2026_01` in the process environment, then configure:

```json
{
  "provenance": {
    "enabled": true,
    "issuer": "impresso-middle-layer",
    "audience": "provenance",
    "activeKid": "2026-01",
    "privateKey": "${PROVENANCE_PRIVATE_KEY}",
    "publicKeys": { "2026-01": "${PROVENANCE_PUBLIC_KEY_2026_01}" },
    "findServices": ["content-items", "search"]
  }
}
```

Environment references use the existing configuration loader. Only reference
variables that are defined, even when provenance is disabled. The default is
disabled when the block is absent. The authentication audience must be explicit
and distinct from provenance (including the web-app authentication audience).
Enabled configurations fail startup if the active signing key is missing or
does not match its registered public key. In development (`NODE_ENV` unset, `development`, or `api-development`) with neither
private nor public keys, startup generates ephemeral keys and logs a warning;
these receipts cannot be verified after restart.

Rotate manually by replacing `privateKey`/`activeKid` and adding the new public
key to `publicKeys`. Keep every historical public key for archival verification.
Persisted export job `extra.provenance` contains `kid`, `idsHash` and `idsCount`.
Keep verification available and retain public keys even if delivery receipts
are disabled.

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
