import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ZipStream from 'zip-stream'

/**
 * A downloadable zip archive of the audit log Parquet objects of a data
 * provider for a single month, written to a temporary file on disk.
 */
export interface PartnerAuditLogArchive {
  /** Absolute path of the temporary zip archive (the caller is responsible for removing it) */
  archivePath: string
  /** Suggested download file name */
  filename: string
  /** Number of Parquet objects packed into the archive */
  objectCount: number
}

/** Entry name of an object inside the archive: `<YYYY-MM-DD>/<object file name>` */
export const auditLogArchiveEntryName = (key: string): string => {
  const segments = key.split('/').filter(segment => segment.length > 0)
  return segments.slice(-2).join('/')
}

export const createAuditLogArchivePath = (): string => join(tmpdir(), `partner-audit-logs-${randomUUID()}.zip`)

const addArchiveEntry = (archive: ZipStream, source: Buffer, name: string): Promise<void> =>
  new Promise((resolve, reject) => {
    // Parquet objects are already zstd-compressed by the Vector sink,
    // so they are stored uncompressed in the archive to avoid wasting CPU.
    archive.entry(source, { name, store: true }, error => {
      if (error != null) reject(error)
      else resolve()
    })
  })

/**
 * Download all audit log objects one by one and pack them into a zip
 * archive on disk, using the existing `zip-stream` utility. Only one
 * object is held in memory at a time.
 */
export const createAuditLogArchive = async (
  keys: string[],
  getObject: (key: string) => Promise<Uint8Array>,
  filename: string,
  archivePath: string = createAuditLogArchivePath()
): Promise<PartnerAuditLogArchive> => {
  const archive = new ZipStream()
  const writeStream = createWriteStream(archivePath)

  try {
    // Wait for the file to be created, otherwise a failure right after the
    // start could remove the archive path before it has ever been opened.
    await once(writeStream, 'open')
    await new Promise<void>((resolve, reject) => {
      archive.on('error', reject)
      writeStream.on('error', reject)
      writeStream.on('finish', () => resolve())

      archive.pipe(writeStream)

      const addAllEntries = async () => {
        for (const key of keys) {
          await addArchiveEntry(archive, Buffer.from(await getObject(key)), auditLogArchiveEntryName(key))
        }
        archive.finalize()
      }
      void addAllEntries().catch(reject)
    })
  } catch (error) {
    archive.destroy()
    writeStream.destroy()
    await rmArchiveQuietly(archivePath)
    throw error
  }

  return { archivePath, filename, objectCount: keys.length }
}

export const rmArchiveQuietly = async (archivePath: string): Promise<void> => {
  await rm(archivePath, { force: true }).catch(() => {
    // Ignore errors if the archive has already been removed
  })
}
