import { strict as assert } from 'assert'
import { BadRequest } from '@feathersjs/errors'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getYearMonthKeyPrefix, type AuditLogStorage } from '@/internalServices/auditLogStorage.js'
import {
  auditLogArchiveEntryName,
  createAuditLogArchive,
} from '@/services/partner-audit-logs/auditLogArchive.js'
import { PartnerAuditLogsService, parseYearMonth } from '@/services/partner-audit-logs/partner-audit-logs.class.js'
import { authorizePartnerAuditLogAccess } from '@/services/partner-audit-logs/authorization.js'
import type { ImpressoApplication } from '@/types.js'

const createFakeApp = (storage: AuditLogStorage): ImpressoApplication =>
  ({
    service: (name: string) => {
      if (name === 'auditLogStorage') return storage
      throw new Error(`unexpected service requested: ${name}`)
    },
  }) as ImpressoApplication

describe('partner-audit-logs service', () => {
  describe('parseYearMonth', () => {
    it('accepts a valid year-month pair', () => {
      assert.deepEqual(parseYearMonth({ year: '2026', month: '8' }), { year: 2026, month: 8 })
      assert.deepEqual(parseYearMonth({ year: 2026, month: 12 }), { year: 2026, month: 12 })
    })

    it('rejects missing or invalid query parameters', () => {
      assert.throws(() => parseYearMonth(undefined), BadRequest)
      assert.throws(() => parseYearMonth({ month: 8 }), BadRequest)
      assert.throws(() => parseYearMonth({ year: 2026 }), BadRequest)
      assert.throws(() => parseYearMonth({ year: 2026.5, month: 8 }), BadRequest)
      assert.throws(() => parseYearMonth({ year: 2026, month: 0 }), BadRequest)
      assert.throws(() => parseYearMonth({ year: 2026, month: 13 }), BadRequest)
      assert.throws(() => parseYearMonth({ year: 'next', month: 8 }), BadRequest)
    })
  })

  describe('get', () => {
    it('zips all objects of the month into a temporary archive', async () => {
      const keys = [
        'audit-logs/BL/2026-08-01/1785861498-aaa.parquet',
        'audit-logs/prod/BL/2026-08-04/1785862000-bbb.parquet',
      ]
      const requestedKeys: string[] = []
      const storage: AuditLogStorage = {
        listYearMonthKeys: async providerId => {
          assert.equal(providerId, 'BL')
          return keys
        },
        getObject: async key => {
          requestedKeys.push(key)
          return Buffer.from(`parquet object of ${key}`)
        },
      }

      const download = await new PartnerAuditLogsService(createFakeApp(storage)).get('BL', {
        query: { year: 2026, month: 8 },
      })

      assert.equal(download.objectCount, 2)
      assert.equal(download.filename, 'audit-logs-BL-2026-08.zip')
      assert.deepEqual(requestedKeys, keys)

      try {
        // zip local file headers contain the entry names, the archive must end
        // with the "end of central directory" signature
        const archiveBytes = await readFile(download.archivePath)
        assert.ok(archiveBytes.length > 0)
        for (const key of keys) {
          assert.ok(
            archiveBytes.includes(Buffer.from(auditLogArchiveEntryName(key))),
            `archive must contain entry ${auditLogArchiveEntryName(key)}`
          )
        }
        assert.ok(archiveBytes.subarray(-22).includes(Buffer.from('PK\x05\x06')), 'archive must have a zip EOCD')
      } finally {
        await rm(download.archivePath, { force: true })
      }
    })

    it('produces an empty archive when there are no objects for the month', async () => {
      const storage: AuditLogStorage = {
        listYearMonthKeys: async () => [],
        getObject: async () => {
          throw new Error('no object should be requested')
        },
      }

      const download = await new PartnerAuditLogsService(createFakeApp(storage)).get('BL', {
        query: { year: 2026, month: 1 },
      })

      try {
        const archiveBytes = await readFile(download.archivePath)
        // an empty zip consists of the 22-byte end of central directory record only
        assert.equal(archiveBytes.length, 22)
        assert.deepEqual(archiveBytes.subarray(0, 4), Buffer.from('PK\x05\x06'))
      } finally {
        await rm(download.archivePath, { force: true })
      }
    })

    it('sanitizes the provider id in the suggested file name', async () => {
      const storage: AuditLogStorage = {
        listYearMonthKeys: async () => [],
        getObject: async () => Buffer.alloc(0),
      }

      const download = await new PartnerAuditLogsService(createFakeApp(storage)).get('../evil/provider', {
        query: { year: 2026, month: 1 },
      })

      assert.equal(download.filename, 'audit-logs-..-evil-provider-2026-01.zip')
      await rm(download.archivePath, { force: true })
    })

    it('validates the query parameters before touching storage', async () => {
      const storage: AuditLogStorage = {
        listYearMonthKeys: async () => {
          throw new Error('storage must not be requested for invalid parameters')
        },
        getObject: async () => {
          throw new Error('storage must not be requested for invalid parameters')
        },
      }

      await assert.rejects(
        new PartnerAuditLogsService(createFakeApp(storage)).get('BL', { query: { year: 2026 } }),
        BadRequest
      )
    })
  })

  describe('createAuditLogArchive', () => {
    it('cleans up the archive file when archiving fails', async () => {
      const storage: AuditLogStorage = {
        listYearMonthKeys: async () => ['audit-logs/BL/2026-08-01/a.parquet'],
        getObject: async () => {
          throw new Error('download failed')
        },
      }
      const archivePath = join(tmpdir(), 'partner-audit-logs-test-failed-archive.zip')

      await assert.rejects(
        createAuditLogArchive(
          await storage.listYearMonthKeys('BL', 2026, 8),
          key => storage.getObject(key),
          'audit-logs-BL-2026-08.zip',
          archivePath
        ),
        /download failed/
      )
      await assert.rejects(readFile(archivePath), /ENOENT/)
    })
  })
})

describe('audit log storage helpers', () => {
  it('builds a month-matching key prefix', () => {
    assert.equal(getYearMonthKeyPrefix('audit-logs', 'BL', 2026, 8), 'audit-logs/BL/2026-08-')
    assert.equal(getYearMonthKeyPrefix('audit-logs/prod', 'BL', 2026, 12), 'audit-logs/prod/BL/2026-12-')
    assert.equal(getYearMonthKeyPrefix('/audit-logs/', 'BL', 2026, 1), 'audit-logs/BL/2026-01-')
  })

  it('builds archive entry names from the object keys', () => {
    assert.equal(
      auditLogArchiveEntryName('audit-logs/prod/BL/2026-08-04/1785861498-59a5197c.parquet'),
      '2026-08-04/1785861498-59a5197c.parquet'
    )
    assert.equal(auditLogArchiveEntryName('file.parquet'), 'file.parquet')
  })
})

describe('partner audit log authorization', () => {
  const staffUser = { uid: 'user-1', id: 1, isStaff: true, bitmap: 1n, groups: [] }
  const regularUser = { uid: 'user-2', id: 2, isStaff: false, bitmap: 1n, groups: [] }

  it('lets staff users through', async () => {
    await assert.doesNotReject(authorizePartnerAuditLogAccess(staffUser, 'BL'))
  })

  it('rejects non-staff and unauthenticated requests until proper authorization is implemented', async () => {
    await assert.rejects(authorizePartnerAuditLogAccess(regularUser, 'BL'))
    await assert.rejects(authorizePartnerAuditLogAccess(undefined, 'BL'))
  })
})
