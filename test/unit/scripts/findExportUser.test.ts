import { strict as assert } from 'assert'
import { exportIdFromFileName, userHashPrefix } from '@/scripts/findExportUser.js'

describe('findExportUser helpers', () => {
  describe('exportIdFromFileName', () => {
    it('strips the directory and the .zip extension', () => {
      assert.equal(
        exportIdFromFileName('/tmp/impresso-exports/2026-10-30_a1b2c3d4_0192f3c9d0ab.zip'),
        '2026-10-30_a1b2c3d4_0192f3c9d0ab'
      )
    })

    it('strips the .csv extension of the intermediate file', () => {
      assert.equal(exportIdFromFileName('2026-10-30_a1b2c3d4_0192f3c9d0ab.csv'), '2026-10-30_a1b2c3d4_0192f3c9d0ab')
    })

    it('accepts a bare export id unchanged', () => {
      assert.equal(exportIdFromFileName('2026-10-30_a1b2c3d4_0192f3c9d0ab'), '2026-10-30_a1b2c3d4_0192f3c9d0ab')
    })
  })

  describe('userHashPrefix', () => {
    it('is the first 8 hex chars of sha256 over the numeric user id', () => {
      // sha256("42").slice(0, 8)
      assert.equal(userHashPrefix(42), '73475cb4')
      // sha256("1234").slice(0, 8)
      assert.equal(userHashPrefix('1234'), '03ac6742')
    })
  })
})
