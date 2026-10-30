/**
 * Find the user who started a search export, from the export file name.
 *
 * Export files are named `<date>_<userHash>_<uuid>` by
 * `src/jobs/searchResults/exportSearchResults.ts`: the finished archive is
 * `<exportId>.zip`, and the intermediate `<exportId>.csv` is written while the
 * job runs (it is what is left behind when the job hangs before zipping).
 *
 * `<userHash>` is a truncated sha256 of the numeric user id, so it cannot be
 * reversed. This script resolves it authoritatively through the `jobs` table
 * (the export job stores `extra.exportId` and `creator_id`), and falls back to
 * hashing every user id and comparing the 8-char prefix when the job record is
 * gone.
 *
 * Usage:
 *   npm run find-export-user -- 2026-10-30_a1b2c3d4_0192f3c9d0ab.zip
 *   npm run find-export-user -- /tmp/impresso-exports/2026-10-30_a1b2c3d4_0192f3c9d0ab.csv
 *   npm run find-export-user -- 2026-10-30_a1b2c3d4_0192f3c9d0ab   # bare export id
 *
 * Options:
 *   --json   print the matched jobs and the resolved user ids as JSON
 *   --help   show this help
 *
 * Environment:
 *   The `.env` file of the repository is used: the `find-export-user` npm
 *   script passes `--env-file=./.env`, and the script also loads it with dotenv
 *   so it can be run directly with `npx tsx src/scripts/findExportUser.ts`.
 */
import { createApp } from '@/appBuilder.js'
import DBJob from '@/models/jobs.model.js'
import configureSequelize from '@/sequelize.js'
import dotenv from 'dotenv'
import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { QueryTypes, Sequelize } from 'sequelize'

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true })

const log = (message = '') => process.stdout.write(`${message}\n`)

const usage = `Usage: npm run find-export-user -- <file-or-exportId> [--json]

Resolve the user who started an export job from its file name (or export id).

The export file name is \`<date>_<userHash>_<uuid>\`, with a \`.zip\` extension
once finished or \`.csv\` while it is still running. The script prints the
numeric user id.

Options:
  --json    print the matched jobs and resolved user ids as JSON
  --help    show this help`

/** The user hash embedded in an export id, i.e. `2026-10-30_<hash>_<uuid>`. */
export const userHashPrefix = (userId: string | number): string =>
  createHash('sha256').update(String(userId)).digest('hex').slice(0, 8)

/** Strip the directory and the `.zip`/`.csv` extension to get the export id. */
export const exportIdFromFileName = (input: string): string =>
  basename(input).replace(/\.(zip|csv)$/i, '')

const main = async () => {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const help = args.includes('--help') || args.includes('-h')
  const positional = args.filter(arg => !arg.startsWith('-'))

  if (help || positional.length === 0) {
    log(usage)
    process.exitCode = help ? 0 : 1
    return
  }

  const input = positional[0]
  const exportId = exportIdFromFileName(input)
  const hash = exportId.split('_')[1]

  const app = createApp()
  await configureSequelize(app)
  const client = app.get('sequelizeClient')!

  try {
    const Job = DBJob.initialize(client)
    const jobs = await Job.unscoped().findAll({
      where: Sequelize.where(Sequelize.fn('JSON_EXTRACT', Sequelize.col('extra'), '$.exportId'), exportId),
      attributes: ['id', 'creatorId', 'type', 'status', 'description'],
      raw: true,
    })

    let source: 'job' | 'hash' = 'job'
    const userIds = [...new Set(jobs.map(job => Number(job.creatorId)))]

    // The job record may have been pruned; fall back to matching the hash
    // prefix embedded in the file name against every user id.
    if (userIds.length === 0 && hash != null) {
      source = 'hash'
      const users = await client.query<{ id: number }>('SELECT id FROM auth_user', { type: QueryTypes.SELECT })
      for (const user of users) {
        if (userHashPrefix(user.id) === hash) userIds.push(user.id)
      }
    }

    if (userIds.length === 0) {
      process.stderr.write(`No user found for "${input}" (export id "${exportId}").\n`)
      process.exitCode = 1
      return
    }

    if (json) {
      log(JSON.stringify({ exportId, source, userIds, jobs }, null, 2))
    } else {
      userIds.forEach(id => log(String(id)))
    }
  } finally {
    await client.close()
  }
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
