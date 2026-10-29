# `writeWellKnownCache` script

Status: implemented; atomic snapshot publication added 2026-10-29.

## Goal

A CLI script `src/scripts/writeWellKnownCache.ts` that rebuilds **one** (or all)
well-known cache entries by calling the same job functions used by
`src/jobs/rebuildWellKnownCache.ts`, without going through the admin service
or the BullMQ queue.

It is the write-side counterpart of `src/scripts/readWellKnownCache.ts`.

## Usage

```bash
npm run write-cache -- topics                  # rebuild the topics cache
npm run write-cache -- media-sources --force   # rebuild media sources, overwriting
npm run write-cache -- all                     # rebuild every entry
npm run write-cache -- --help
```

Package script to add next to `read-cache` in `package.json`:

```json
"write-cache": "tsx --env-file=./.env src/scripts/writeWellKnownCache.ts"
```

The `.env` file of the repository is used, as for the other scripts of the
project: the npm script passes `--env-file=./.env`, and the script also loads
the same file with dotenv (path resolved relative to the script, missing file
ignored) so it can be run directly. The variables referenced by the
configuration (`${DB_HOSTNAME}`, `${SOLR_BASE_URL}`, ...) come from there.
Variables already present in the environment always win.

## Entries

The argument selects the job. Each entry has a preparation function and an update job. The BullMQ rebuild
prepares all entries before publishing; the CLI processes selected entries in sequence.

| arg | job | cache key | metadata key |
| --- | --- | --- | --- |
| `media-sources` | `updateMediaSourcesCache` (`src/jobs/updateMediaSourcesCache.ts`) | `cache:mediaSources` | `cache:meta:mediaSources:computedAt` |
| `years` | `updateYears` (`src/jobs/updateYears.ts`) | `cache:years` | `cache:meta:years:computedAt` |
| `topics` | `updateTopicsCache` (`src/jobs/updateTopicsCache.ts`) | `cache:topics` | `cache:meta:topics:computedAt` |
| `special-membership-access` | `updateSpecialMembershipAccessCache` (`src/jobs/updateSpecialMembershipAccessCache.ts`) | `cache:specialMembershipAccess:byBitmapPosition` | `cache:meta:specialMembershipAccess:computedAt` |
| `all` | the four above | | |

Keys come from `WellKnownKeys` / `WellKnownMetadataKeys` in `src/cache.ts`;
they are not hardcoded in the script. These are the legacy keys. New publications
store `{ key, data, version, computedAt }` together at `<cache key>:snapshot`,
where `data` is the serialized dataset and `version` is a UUID. A single Redis
SET replaces the entire record, with a 100-day TTL in milliseconds.

Readers prefer the snapshot record and fall back to legacy data/timestamp keys
until the first successful rebuild. Both CLI tools, the admin timestamps and
all well-known-data services understand this format. Legacy keys are kept but
are no longer updated: older application versions and direct Redis consumers
will continue seeing their old data. Upgrade all readers/writers before relying
on rebuilds; rolling back to older code requires repopulating its legacy keys.

Local memoized readers invalidate immediately after publication through their
cache manager. Other instances discover the replacement at their next
30-second check. Data and version are always read from the same record.

## Behaviour

1. Parse `argv`: one entry (required) plus flags.
2. Bootstrap the minimum app needed by the selected jobs (see below).
3. For the selected entry: if the cache key already exists, the script reports
   "already cached" and exits 0 without changing anything, unless `--force` is
   passed. With `--force`, the job computes a replacement while the live entry
   remains readable, then atomically publishes the replacement.
4. Run the job, then read the published record and print its `computedAt`
   timestamp and entry size. Preparation and publication errors propagate and
   cause exit code 1; the previous record remains intact.
5. Disconnect cache and DB in a `finally` block.

The jobs accept `(app, { force?: boolean })`; the script calls them directly. No BullMQ queue, no worker, no job payload.

## App bootstrap

Only what the selected job needs, mirroring `readWellKnownCache.ts`:

- `createApp()` from `src/appBuilder.ts` (configuration + logger).
- `app.configure(cache)` — the cache opens its own Redis connection, so the
  `redisClient` service is not needed.
- `init` from `src/internalServices/simpleSolr.js` (registers the
  `simpleSolrClient` service) — needed by `topics`, `years`,
  `media-sources`.
- `app.configure(sequelize)` — needed by `media-sources` and
  `special-membership-access`.

`src/app.ts` is **not** imported: it registers all services, the queue worker
manager and the startup jobs, which are unwanted side effects for a one-shot
script.

The cache must be enabled (`cache.enabled === true` in the configuration),
otherwise the script exits with an error, like `readWellKnownCache.ts` does.

## Exit codes

| code | meaning |
| --- | --- |
| 0 | success (or "nothing to do") |
| 1 | unknown entry, missing cache configuration, or job failure |

## Files

- new: `src/scripts/writeWellKnownCache.ts`
- new: `docs/specs/write-well-known-cache.md` (this file)
- changed: `package.json` (`write-cache` script)

## Implementation notes

- The entries are declared in a table (`WellKnownEntry[]`) that maps the
  command-line name to the job, the cache key, the metadata key and the
  dependencies (Solr, database). The `all` entry uses the same table, in the
  order of `rebuildWellKnownCache.ts`.
- Only the dependencies of the selected entries are configured: the Solr client
  is registered only when a job needs it, the database client only when a job
  needs it.
- Unknown options (e.g. `--forse`) and extra positional arguments are
  rejected with the usage text and exit code 1.
- After the job, the script reads the key back. A missing key is an error
  (exit code 1). The jobs also propagate computation and publication errors.

## Publication failure behavior

The BullMQ rebuild computes every dataset before publishing any replacement.
A preparation failure leaves all datasets untouched. Publication is atomic per
dataset, rather than a transaction across all four datasets: if a later write
fails, earlier successful publications remain live and the failed entry keeps
its previous record. A retry rebuilds and republishes all entries.

Publication checks the configured Keyv store's boolean write result directly
because cache-manager does not propagate a false result. Redis adapter errors
are reported to Keyv; ordinary cache writes retain their existing best-effort
behavior. Publication requires the single-store configuration used by this app.

## Out of scope

- Triggering the BullMQ `rebuildWellKnownCache` job: the admin service already
  does that (`rebuild-well-known-cache`).
- `updateFacetRanges` (`src/jobs/updateFacetRanges.ts`): it writes a JSON file,
  not a well-known Redis entry.

## Decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Existing key | The script refuses to overwrite and exits 0 with "already cached" unless `--force` is passed. `--force` computes and publishes a replacement without deleting live data. |
| 2 | `all` | Calls the four `update*` jobs directly, in the order used by `rebuildWellKnownCache.ts`. The BullMQ handler is not reused. |
| 3 | Entries | Only the four well-known Redis entries. `updateFacetRanges` is excluded. |

## Open questions

- **Dry run.** Should there be a `--dry-run` that only reports what would be
  rebuilt (key present, job name)? Not required, cheap to add.
