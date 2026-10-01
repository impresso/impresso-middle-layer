import { strict as assert } from 'assert'
import { BadRequest, Forbidden, NotAuthenticated } from '@feathersjs/errors'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getYearMonthKeyPrefix, type AuditLogStorage } from '@/internalServices/auditLogStorage.js'
import { auditLogArchiveEntryName, createAuditLogArchive } from '@/services/partner-audit-logs/auditLogArchive.js'
import { PartnerAuditLogsService, parseYearMonth } from '@/services/partner-audit-logs/partner-audit-logs.class.js'
import SpecialMembershipAccess from '@/models/special-membership-access.model.js'
import { setupTestApp, withAuditLogStorage, withDatabase } from '../../../helpers/app.js'

const staffUser = { uid: 'user-1', id: 1, isStaff: true, bitmap: 1n, groups: [] }
const regularUser = { uid: 'user-2', id: 2, isStaff: false, bitmap: 1n, groups: [] }

const emptyStorage: AuditLogStorage = {
  listYearMonthKeys: async () => [],
  getObject: async () => Buffer.alloc(0),
}

/** A storage that fails the test if it is touched at all. */
const forbiddenStorage = (reason: string): AuditLogStorage => ({
  listYearMonthKeys: async () => {
    throw new Error(reason)
  },
  getObject: async () => {
    throw new Error(reason)
  },
})

const ZIP_EOCD_SIGNATURE = Buffer.from('PK\x05\x06')

// ---------------------------------------------------------------------------
// Pure unit tests (no database, no service instance)
// ---------------------------------------------------------------------------

describe('parseYearMonth', () => {
  it('accepts a valid year-month pair', () => {
    assert.deepEqual(parseYearMonth({ year: '2026', month: '8' }), { year: 2026, month: 8 })
    assert.deepEqual(parseYearMonth({ year: 2026, month: 12 }), { year: 2026, month: 12 })
    assert.deepEqual(parseYearMonth({ year: 2026, month: 1 }), { year: 2026, month: 1 })
  })

  it('rejects missing or invalid query parameters', () => {
    assert.throws(() => parseYearMonth(undefined), BadRequest)
    assert.throws(() => parseYearMonth(null), BadRequest)
    assert.throws(() => parseYearMonth({}), BadRequest)
    assert.throws(() => parseYearMonth({ month: 8 }), BadRequest)
    assert.throws(() => parseYearMonth({ year: 2026 }), BadRequest)
    assert.throws(() => parseYearMonth({ year: 2026.5, month: 8 }), BadRequest)
    assert.throws(() => parseYearMonth({ year: 2026, month: 0 }), BadRequest)
    assert.throws(() => parseYearMonth({ year: 2026, month: 13 }), BadRequest)
    assert.throws(() => parseYearMonth({ year: 2026, month: -1 }), BadRequest)
    assert.throws(() => parseYearMonth({ year: 'next', month: 8 }), BadRequest)
    assert.throws(() => parseYearMonth({ year: 2026, month: '8abc' }), BadRequest)
    assert.throws(() => parseYearMonth({ year: '', month: 8 }), BadRequest)
    assert.throws(() => parseYearMonth({ year: 2026, month: '' }), BadRequest)
  })
})

describe('createAuditLogArchive', () => {
  let workDir: string

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'partner-audit-logs-test-'))
  })

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  it('cleans up the archive file when archiving fails', async () => {
    const keys = ['audit-logs/BL/2026-08-01/a.parquet', 'audit-logs/BL/2026-08-02/b.parquet']
    const archivePath = join(workDir, 'failed-archive.zip')
    let calls = 0

    await assert.rejects(
      createAuditLogArchive(
        keys,
        async () => {
          // first object succeeds so the archive file is started, the second one fails
          if (++calls === 2) throw new Error('download failed')
          return Buffer.from('ok')
        },
        'audit-logs-BL-2026-08.zip',
        archivePath
      ),
      /download failed/
    )

    assert.equal(calls, 2, 'the failing object must have been reached')
    await assert.rejects(readFile(archivePath), /ENOENT/)
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

// ---------------------------------------------------------------------------
// Service tests (database backed)
// ---------------------------------------------------------------------------

describe('partner-audit-logs service', () => {
  let testApp: ReturnType<
    typeof setupTestApp<[ReturnType<typeof withDatabase>, ReturnType<typeof withAuditLogStorage>]>
  >
  let service: PartnerAuditLogsService

  // every archive produced by service.get() is registered here and removed after each test,
  // even when an assertion fails halfway through
  const createdArchives: string[] = []
  const trackArchive = <T extends { archivePath: string }>(download: T): T => {
    createdArchives.push(download.archivePath)
    return download
  }

  before(async () => {
    testApp = setupTestApp(withDatabase(), withAuditLogStorage(emptyStorage))
    SpecialMembershipAccess.initialize(testApp.sequelize)
    await testApp.sequelize.sync({ force: true })
    service = new PartnerAuditLogsService(testApp.app)
  })

  after(async () => {
    await testApp.teardown()
  })

  beforeEach(async () => {
    await testApp.sequelize.truncate({ cascade: true })
    testApp.setAuditLogStorage(emptyStorage)
  })

  afterEach(async () => {
    await Promise.all(createdArchives.splice(0).map(path => rm(path, { force: true })))
  })

  describe('get', () => {
    it('zips all objects of the month into a temporary archive', async () => {
      const keys = [
        'audit-logs/BL/2026-08-01/1785861498-aaa.parquet',
        'audit-logs/prod/BL/2026-08-04/1785862000-bbb.parquet',
      ]
      const requestedKeys: string[] = []
      testApp.setAuditLogStorage({
        listYearMonthKeys: async providerId => {
          assert.equal(providerId, 'BL')
          return keys
        },
        getObject: async key => {
          requestedKeys.push(key)
          return Buffer.from(`parquet object of ${key}`)
        },
      })

      const download = trackArchive(
        await service.get('BL', {
          query: { year: 2026, month: 8 },
          user: staffUser,
        })
      )

      assert.equal(download.objectCount, 2)
      assert.equal(download.filename, 'audit-logs-BL-2026-08.zip')
      assert.deepEqual(requestedKeys, keys)

      // zip local file headers contain the entry names, and the archive must end
      // with the "end of central directory" signature
      const archiveBytes = await readFile(download.archivePath)
      assert.ok(archiveBytes.length > 0)
      for (const key of keys) {
        assert.ok(
          archiveBytes.includes(Buffer.from(auditLogArchiveEntryName(key))),
          `archive must contain entry ${auditLogArchiveEntryName(key)}`
        )
      }
      assert.deepEqual(archiveBytes.subarray(-22, -18), ZIP_EOCD_SIGNATURE, 'archive must have a zip EOCD')
    })

    it('produces an empty archive when there are no objects for the month', async () => {
      testApp.setAuditLogStorage({
        listYearMonthKeys: async () => [],
        getObject: async () => {
          throw new Error('no object should be requested')
        },
      })

      const download = trackArchive(
        await service.get('BL', {
          query: { year: 2026, month: 1 },
          user: staffUser,
        })
      )

      assert.equal(download.objectCount, 0)
      const archiveBytes = await readFile(download.archivePath)
      // an empty zip consists of the 22-byte end of central directory record only
      assert.equal(archiveBytes.length, 22)
      assert.deepEqual(archiveBytes.subarray(0, 4), ZIP_EOCD_SIGNATURE)
    })

    it('sanitizes the provider id in the suggested file name', async () => {
      const download = trackArchive(
        await service.get('../evil/provider', {
          query: { year: 2026, month: 1 },
          user: staffUser,
        })
      )

      assert.equal(download.filename, 'audit-logs-..-evil-provider-2026-01.zip')
    })

    it('validates the query parameters before touching storage', async () => {
      testApp.setAuditLogStorage(forbiddenStorage('storage must not be requested for invalid parameters'))

      await assert.rejects(
        service.get('BL', {
          query: { year: 2026 },
          user: staffUser,
        }),
        BadRequest
      )
    })
  })

  describe('authorization', () => {
    const query = { year: 2026, month: 1 }

    it('lets staff users through', async () => {
      const download = trackArchive(await service.get('BL', { query, user: staffUser }))

      assert.equal(download.filename, 'audit-logs-BL-2026-01.zip')
    })

    it('lets a reviewer access audit logs for their matching data provider', async () => {
      await SpecialMembershipAccess.create({
        title: 'BL reviewer',
        bitmapPosition: 1,
        reviewerId: regularUser.id,
        dataProviderAlias: 'BL',
      })

      const download = trackArchive(await service.get('BL', { query, user: regularUser }))

      assert.equal(download.filename, 'audit-logs-BL-2026-01.zip')
    })

    it('rejects a reviewer of another data provider', async () => {
      await SpecialMembershipAccess.create({
        title: 'Other provider reviewer',
        bitmapPosition: 1,
        reviewerId: regularUser.id,
        dataProviderAlias: 'GDL',
      })
      testApp.setAuditLogStorage(forbiddenStorage('storage must not be requested for unauthorized users'))

      await assert.rejects(service.get('BL', { query, user: regularUser }), Forbidden)
    })

    it('rejects a non-staff user without any membership access record', async () => {
      testApp.setAuditLogStorage(forbiddenStorage('storage must not be requested for unauthorized users'))

      await assert.rejects(service.get('BL', { query, user: regularUser }), Forbidden)
    })

    it('rejects unauthorized requests', async () => {
      testApp.setAuditLogStorage(forbiddenStorage('storage must not be requested for unauthorized requests'))

      await assert.rejects(service.get('BL', { query }), Forbidden)
    })
  })
})
