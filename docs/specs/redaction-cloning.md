# Redaction without a JSON round trip

`redactObject` copies response data in memory before applying the ordered policy
items. It no longer serializes the entire response and parses it back merely to
obtain a mutable copy. Immutable strings can be reused, including transcripts
that a policy will subsequently discard or replace.

The copy remains detached from the input, including branches untouched by the
policy. Repeated references are copied independently, matching JSON round-trip
behavior. Circular values are rejected.

## Policy-visible values

`cloneForRedaction` preserves the normalization previously performed by the JSON
codec: Date and custom `toJSON` output, omitted object values, null array holes,
finite/non-finite numbers, negative zero, safe/unsafe integer classification,
boxed primitives, raw JSON primitives, null prototypes, and forbidden property
checks. Getters and `toJSON` are evaluated once in property order.

`structuredClone` was benchmarked but does not supply this JSON view: it preserves
Dates, undefined values and shared references, drops custom class serialization,
and rejects function-valued properties that JSON would omit. The in-memory JSON
view keeps those differences out of policy matching.

JSONPath already caches parsed paths in the installed jsonpath-plus version.
The existing traversal and immediate callback mutations remain in policy order;
there is no second expression cache or alternate path evaluator.

## Authorization metadata

The known `AuthorizationBitmapsKey` symbol is copied separately at object nodes.
Its permission fields remain detached from the input and retain bigint values.
Other symbols remain omitted, matching the former JSON clone.

This intentionally fixes the content-item redaction sequence: the blanket policy
removes public access-bitmap fields, then a permission-dependent policy checks the
internal symbol. Previously the JSON clone removed that symbol, allowing the
next permission check to fall back to open permissions. The new copy preserves
the authorization decision through both hooks. The symbol remains absent from
HTTP JSON and Socket.io JSON serialization.

Regression tests exercise both get/find hook chains for public and restricted
content, input isolation, normalization, ordered overlapping policies, repeated
references, and cycle/forbidden-property failures.

## Benchmark

```sh
npm run benchmark:redaction
```

The script checks wire-equivalent redaction against the old round trip and
`structuredClone`, then measures median process CPU microseconds per operation
over five batches of 200 operations after warmup. These are synthetic item
fixtures and include the same JSONPath policy application in each redaction
measurement. The baseline uses the native codec introduced by optimization #3.

Example results on Node 24.22.2:

| Fixture | Old redaction | structuredClone redaction | In-memory redaction | Speedup over old |
| --- | --- | --- | --- | --- |
| Short item | 52.9 µs | 29.8 µs | 22.9 µs | 2.31× |
| Long transcript | 188.1 µs | 53.1 µs | 24.2 µs | 7.76× |

Full unit suites pass on Node 24.22.2 and Node 26.7.0. Production throughput and
heap behavior still need verification with the mixed-endpoint load experiment.

The Node 24 verification used a temporary npm-provided runtime. To reproduce it
without changing the system Node installation:

```sh
npm exec --yes --package=node@24.22.2 -- node --import tsx node_modules/mocha/bin/mocha.js
npm exec --yes --package=node@24.22.2 -- node --import tsx src/scripts/benchmarkRedaction.ts
```

## Standard JSON typings

TypeScript 7.0.2 is the latest stable release at implementation time. Official
JSON source/rawJSON declarations arrive with TypeScript 7.1, currently beta.
`src/types/native-json.d.ts` temporarily declares the Node-supported APIs; remove
it when upgrading to the official ES2026 JSON declarations.
