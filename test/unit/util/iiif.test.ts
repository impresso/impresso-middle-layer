import * as assert from 'assert'
import { getV3CompatibleIIIFUrl } from '@/util/iiif.js'

describe('getV3CompatibleIIIFUrl', () => {
  it('should convert a v2 URL with full to v3 with max', () => {
    const v2Url = 'http://example.com/iiif/image1/full/full/0/default.jpg'
    const expectedV3Url = 'http://example.com/iiif/image1/full/max/0/default.jpg'
    assert.strictEqual(getV3CompatibleIIIFUrl(v2Url), expectedV3Url)
  })

  it('should return the same URL if already v3 compatible', () => {
    const v3Url = 'http://example.com/iiif/image2/10,20,30,40/pct:50/90/color.png'
    assert.strictEqual(getV3CompatibleIIIFUrl(v3Url), v3Url)
  })
})
