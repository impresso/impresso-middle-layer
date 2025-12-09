import { bitmapsAlign, BitMapsAlignContext, unlessHasPermissionAndWithinQuota } from '../../../src/hooks/redaction'
import assert from 'assert'
import {
  BufferUserPlanAuthUser,
  BufferUserPlanEducational,
  BufferUserPlanGuest,
  BufferUserPlanResearcher,
} from '../../../src/models/user-bitmap.model'
import { HookContext } from '@feathersjs/feathers'
import { ImpressoApplication } from '../../../src/types'
import { AuthorizationBitmapsKey } from '../../../src/models/authorization'

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
      const accessAllowed = ExpectedAllowed[contentLabel as keyof typeof ContentBitmaps].includes(planLabel)

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

describe('unlessHasPermissionAndWithinQuota', () => {
  it('should redact when user lacks permission', async () => {
    const condition = unlessHasPermissionAndWithinQuota('explore')
    const context = {
      params: {
        user: { id: 'user-1', bitmap: BufferUserPlanGuest },
      },
    } as any as HookContext<ImpressoApplication>

    const redactable = {
      id: 'doc-1',
      [AuthorizationBitmapsKey]: {
        explore: BigInt(0b10), // Restricted - Guest doesn't have this
      },
    }

    const shouldRedact = await condition(context, redactable)
    assert.strictEqual(shouldRedact, true, 'Should redact when user lacks permission')
  })

  it('should not redact when user has permission and within quota', async () => {
    const condition = unlessHasPermissionAndWithinQuota('explore')
    const context = {
      params: {
        user: { id: 'user-2', bitmap: BufferUserPlanAuthUser },
      },
      app: {
        service: (name: string) => {
          if (name === 'quotaChecker') {
            return {
              check: async () => ({ allowed: true, count: 5, wasCounted: false, windowStart: 0, secondsUntilReset: 86400 }),
            }
          }
        },
      },
    } as any as HookContext<ImpressoApplication>

    const redactable = {
      id: 'doc-2',
      [AuthorizationBitmapsKey]: {
        explore: BigInt(0b1), // Open - AuthUser has this
      },
    }

    const shouldRedact = await condition(context, redactable)
    assert.strictEqual(shouldRedact, false, 'Should not redact when user has permission and within quota')
  })

  it('should redact when user has permission but exceeded quota', async () => {
    const condition = unlessHasPermissionAndWithinQuota('explore')
    const context = {
      params: {
        user: { id: 'user-3', bitmap: BufferUserPlanAuthUser },
      },
      app: {
        service: (name: string) => {
          if (name === 'quotaChecker') {
            return {
              check: async () => ({ allowed: false, count: 100, wasCounted: false, windowStart: 0, secondsUntilReset: 86400 }),
            }
          }
        },
      },
    } as any as HookContext<ImpressoApplication>

    const redactable = {
      id: 'doc-3',
      [AuthorizationBitmapsKey]: {
        explore: BigInt(0b1), // Open - AuthUser has this
      },
    }

    const shouldRedact = await condition(context, redactable)
    assert.strictEqual(shouldRedact, true, 'Should redact when user exceeded quota')
  })

  it('should handle missing user gracefully', async () => {
    const condition = unlessHasPermissionAndWithinQuota('explore')
    const context = {
      params: {},
    } as any as HookContext<ImpressoApplication>

    const redactable = {
      id: 'doc-4',
      [AuthorizationBitmapsKey]: {
        explore: BigInt(0b1),
      },
    }

    const shouldRedact = await condition(context, redactable)
    assert.strictEqual(shouldRedact, false, 'Should not redact when user is missing')
  })

  it('should handle quota checker errors gracefully', async () => {
    const condition = unlessHasPermissionAndWithinQuota('explore')
    const context = {
      params: {
        user: { id: 'user-4', bitmap: BufferUserPlanAuthUser },
      },
      app: {
        service: (name: string) => {
          if (name === 'quotaChecker') {
            return {
              check: async () => {
                throw new Error('Redis connection failed')
              },
            }
          }
        },
      },
    } as any as HookContext<ImpressoApplication>

    const redactable = {
      id: 'doc-5',
      [AuthorizationBitmapsKey]: {
        explore: BigInt(0b1),
      },
    }

    const shouldRedact = await condition(context, redactable)
    assert.strictEqual(shouldRedact, false, 'Should allow access when quota check fails')
  })
})
