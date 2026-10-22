# `writeWellKnownCache` script

Status: implemented (2026-10-22).

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

The argument selects the job. The jobs are the ones already imported by
`src/jobs/rebuildWellKnownCache.ts`, called in the same order.

| arg | job | cache key | metadata key |
| --- | --- | --- | --- |
| `topics` | `updateTopicsCache` (`src/jobs/updateTopicsCache.ts`) | `cache:topics` | `cache:meta:topics:computedAt` |
| `media-sources` | `updateMediaSourcesCache` (`src/jobs/updateMediaSourcesCache.ts`) | `cache:mediaSources` | `cache:meta:mediaSources:computedAt` |
| `years` | `updateYears` (`src/jobs/updateYears.ts`) | `cache:years` | `cache:meta:years:computedAt` |
| `special-membership-access` | `updateSpecialMembershipAccessCache` (`src/jobs/updateSpecialMembershipAccessCache.ts`) | `cache:specialMembershipAccess:byBitmapPosition` | `cache:meta:specialMembershipAccess:computedAt` |
| `all` | the four above | | |

Keys come from `WellKnownKeys` / `WellKnownMetadataKeys` in `src/cache.ts`;
they are not hardcoded in the script.

## Behaviour

1. Parse `argv`: one entry (required) plus flags.
2. Bootstrap the minimum app needed by the selected jobs (see below).
3. For the selected entry: if the cache key already exists, the script reports
   "already cached" and exits 0 without changing anything, unless `--force` is
   passed. With `--force`, the key (and its metadata key) is deleted first,
   exactly like `clearWellKnownCache` does in `rebuildWellKnownCache.ts`.
4. Run the job, then check that the key was written (`updateYears` swallows its
   own errors, so a missing key after the job is an error, exit code 1) and
   print the new `computedAt` timestamp and the entry size.
5. Disconnect cache and DB in a `finally` block.

The jobs are plain `async (app) => void` functions; the script calls them
directly. No BullMQ queue, no worker, no job payload.

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
  (exit code 1): `updateYears` catches its own errors and does not rethrow, so
  the read-back is the only way to detect the failure.

## Out of scope

- Triggering the BullMQ `rebuildWellKnownCache` job: the admin service already
  does that (`rebuild-well-known-cache`).
- `updateFacetRanges` (`src/jobs/updateFacetRanges.ts`): it writes a JSON file,
  not a well-known Redis entry.
- The TTL bug in `updateTopicsCache.ts` (`60 * 60 * 24 * 100 * 1000`).

## Decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Existing key | The script refuses to overwrite and exits 0 with "already cached" unless `--force` is passed. `--force` deletes the key and its metadata key first. |
| 2 | `all` | Calls the four `update*` jobs directly, in the order used by `rebuildWellKnownCache.ts`. The BullMQ handler is not reused. |
| 3 | Entries | Only the four well-known Redis entries. `updateFacetRanges` is excluded. |

## Open questions

- **Dry run.** Should there be a `--dry-run` that only reports what would be
  rebuilt (key present, job name)? Not required, cheap to add.
