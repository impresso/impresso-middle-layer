import assert from 'assert'
import { getNameFromUid, getTypeCodeFromUid } from '../../src/utils/entity.utils'

describe('Entity utility functions', () => {
  describe('getNameFromUid', () => {
    it('should extract name from aida uid', () => {
      const uid = 'aida-10-50-Paris'
      const result = getNameFromUid(uid)
      assert.strictEqual(result, 'Paris')
    })

    it('should extract name from aida uid with underscores', () => {
      const uid = 'aida-10-50-New_York_City'
      const result = getNameFromUid(uid)
      assert.strictEqual(result, 'New York City')
    })

    it('should extract name from bert uid', () => {
      const uid = 'bert-person-21-john_doe'
      const result = getNameFromUid(uid)
      assert.strictEqual(result, 'john doe')
    })

    it('should handle uids with special characters', () => {
      const uid = 'aida-10-50-Jürgen_Müller'
      const result = getNameFromUid(uid)
      assert.strictEqual(result, 'Jürgen Müller')
    })

    it('should extract name from format 2-50-Name', () => {
      const uid = '2-50-Kanton_Waadt'
      const result = getNameFromUid(uid)
      assert.strictEqual(result, 'Kanton Waadt')
    })

    it('should extract name from format aida-0001-50-Name', () => {
      const uid = 'aida-0001-50-Willy_Brandt'
      const result = getNameFromUid(uid)
      assert.strictEqual(result, 'Willy Brandt')
    })

    it('should handle location entities in format 2-54-Name', () => {
      const uid = '2-54-Wangen_im_Allgäu'
      const result = getNameFromUid(uid)
      assert.strictEqual(result, 'Wangen im Allgäu')
    })
  })

  describe('getTypeCodeFromUid', () => {
    it('should extract type from aida uid for person', () => {
      const uid = 'aida-10-50-John_Smith'
      const result = getTypeCodeFromUid(uid)
      assert.strictEqual(result, '50')
    })

    it('should extract type from aida uid for location', () => {
      const uid = 'aida-10-54-Berlin'
      const result = getTypeCodeFromUid(uid)
      assert.strictEqual(result, '54')
    })

    it('should extract type from aida uid for organisation', () => {
      const uid = 'aida-2-53-Kreiszahl'
      const result = getTypeCodeFromUid(uid)
      assert.strictEqual(result, '53')
    })

    it('should extract type from org uid for organisation', () => {
      const uid = '2-53-Kreiszahl'
      const result = getTypeCodeFromUid(uid)
      assert.strictEqual(result, '53')
    })

    it('should handle uids with complex names', () => {
      const uid = 'aida-10-50-Complex$20$Name_With$2D$Symbols'
      const result = getTypeCodeFromUid(uid)
      assert.strictEqual(result, '50')
    })

    it('should extract type from format 2-50-Name', () => {
      const uid = '2-50-Kanton_Waadt'
      const result = getTypeCodeFromUid(uid)
      assert.strictEqual(result, '50')
    })

    it('should extract type from format aida-0001-54-Name', () => {
      const uid = 'aida-0001-54-Fribourg'
      const result = getTypeCodeFromUid(uid)
      assert.strictEqual(result, '54')
    })
  })
})
