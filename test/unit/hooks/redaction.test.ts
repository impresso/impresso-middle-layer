import { bitmapsAlign, BitMapsAlignContext } from '../../../src/hooks/redaction'
import assert from 'assert'
import {
  BufferUserPlanAuthUser,
  BufferUserPlanEducational,
  BufferUserPlanGuest,
  BufferUserPlanResearcher,
} from '../../../src/models/user-bitmap.model'

const contextWithBitmap = (bitmap: bigint): BitMapsAlignContext => ({
  params: {
    user: { bitmap },
  },
})

const PlanBitmaps = {
  Guest: BufferUserPlanGuest,
  AuthUser: BufferUserPlanAuthUser,
  Educational: BufferUserPlanEducational,
  Researcher: BufferUserPlanResearcher,
}

const ContentBitmaps = {
  Open: BigInt(0b1),
  Restricted: BigInt(0b10),
}

const ExpectedAllowed: Record<keyof typeof ContentBitmaps, string[]> = {
  Open: ['Guest', 'AuthUser', 'Educational', 'Researcher'],
  Restricted: ['AuthUser', 'Educational', 'Researcher'],
}

describe('redaction', () => {
  Object.entries(ContentBitmaps).forEach(([contentLabel, contentBitmap]) => {
    Object.entries(PlanBitmaps).forEach(([planLabel, planBitmap]) => {
      const accessAllowed = ExpectedAllowed[contentLabel].includes(planLabel)

      const context = contextWithBitmap(planBitmap)
      const redactable = { contentBitmap }

      it(`${planLabel} (${planBitmap.toString(2)}) ${accessAllowed ? 'can' : 'can NOT'} access ${contentLabel} (${contentBitmap.toString(2)})`, () => {
        assert.strictEqual(
          bitmapsAlign(context, redactable, x => x.contentBitmap),
          accessAllowed
        )
      })
    })
  })
})
