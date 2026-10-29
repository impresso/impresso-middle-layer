# Native JSON codec

`src/util/jsonCodec.ts` uses native JSON parsing and serialization on Node 24+.
The shared helpers cover Solr responses and requests, HTTP request and response
bodies, and the existing redaction clone. No runtime path imports `json-bigint`;
it remains installed as the reference implementation for the benchmark.

## Compatibility

- Integer tokens outside the safe Number range become bigint using the original
  token digits, preserving authorization bitmaps and other 64-bit values.
- Decimal and exponent tokens remain Number values, matching the previous codec.
  Non-finite numbers from overflowing input tokens are rejected.
- Parsed objects retain null prototypes. Forbidden property names, including
  Unicode-escaped variants, remain rejected.
- HTTP bigint values serialize as unquoted JSON numbers using `JSON.rawJSON`.
  Socket.io retains its separate bigint-to-string replacer.
- Getters and `toJSON` run once during serialization; there is no serialization
  retry or prewalk that could trigger them twice.
- Native JSON syntax validation is stricter than the former parser for malformed
  inputs such as leading-zero numbers. Equivalent valid strings may use different
  Unicode escaping on output, with the same decoded values.

## Parsing strategy

Ordinary payloads use native `JSON.parse` followed by an iterative compatibility
pass. If a parsed Number is an integer outside the safe range, the payload is
reparsed with a source-aware reviver. This retrieves the original digits before
precision was lost; converting an already-rounded Number to bigint is unsafe.

Using a source-aware reviver unconditionally regressed facet-heavy payloads in
the benchmark. The conditional approach avoids allocating a source context and
calling a reviver for every value in ordinary responses. Serialization uses one
native `JSON.stringify` call with a bigint replacer.

## Verification

Tests cover safe-integer and signed/unsigned 64-bit boundaries, exact authorization
bits, decimal/exponent behavior, forbidden properties, null prototypes, malformed
input, HTTP numeric tokens, and Socket.io string-valued bigints.

Run the reproducible synthetic benchmark with:

```sh
node --import tsx src/scripts/benchmarkJsonCodec.ts
```

It first checks equivalent results against the installed legacy codec, then
reports median process CPU microseconds per operation over five warmed-up batches
of 200 operations. The fixtures are synthetic content pages, facet buckets, and
HTTP DTOs; this does not measure end-to-end throughput.

The full unit suite passes on Node 24.22.2 and Node 26.7.0. Example local
benchmark results on Node 24.22.2:

| Fixture | Parse speedup | Stringify speedup |
| --- | --- | --- |
| Solr content page with 64-bit bitmaps | 4.29× | 1.98× |
| Solr facet buckets | 1.41× | 1.84× |
| HTTP content page | 6.16× | 2.23× |

Rerun on the deployed Node version and repeat the mixed-endpoint load experiment
to quantify production impact.
