import { strict as assert } from 'assert'
import { feathers, type Params } from '@feathersjs/feathers'
import type { AppServices } from '@/types.js'
import { ensureServiceIsFeathersCompatible } from '@/util/feathers.js'
import type { Configuration } from '@/configuration.js'
import type { SlimUser } from '@/authentication.js'
import { AuthorizationBitmapsKey } from '@/models/authorization.js'
import { BufferUserPlanResearcher } from '@/models/user-bitmap.model.js'
import { contentItemsAfterFindHooks } from '@/services/content-items/content-items.hooks.js'
import type { IQuotaChecker } from '@/services/internal/quotaChecker/redis.js'

interface Item {
  id: string
  text: { title: string; content: string }
  [key: symbol]: unknown
}

interface FindParams extends Params {
  user?: SlimUser
  asPublicApi?: boolean
}

// The researcher plan has bits 0b1011.
const GrantedToResearcher = BigInt(0b1000)
const DeniedToResearcher = BigInt(0b0100)

const researcher: SlimUser = {
  id: 1,
  uid: 'local-researcher',
  isStaff: false,
  bitmap: BufferUserPlanResearcher,
  groups: [],
}

const allowAllQuotaChecker: IQuotaChecker = {
  check: async () => ({ allowed: true, count: 1, wasCounted: true, windowStart: 0, secondsUntilReset: 0 }),
  getState: async () => ({
    currentPosition: 0,
    quota: 0,
    percentageUsed: 0,
    secondsUntilReset: 0,
    windowLengthSeconds: 0,
  }),
}

/**
 * Runs the content-items `find` after-hooks in the web app (non public API) mode
 * against a single item with the given authorization bitmaps.
 */
const findInWebApp = async (bitmaps: { explore: bigint; getTranscript: bigint }, params: FindParams) => {
  // Same type as `ImpressoApplication`, so the real hooks can be attached without casts.
  const app = feathers<AppServices & Record<string, any>, Configuration>()
  app.set('isPublicApi', false)
  app.set('images', {
    baseUrl: '',
    proxy: { sources: [{ id: 'test', endpoint: 'https://example.com' }] },
    rewriteRules: [],
  })
  app.use('quotaChecker', ensureServiceIsFeathersCompatible(allowAllQuotaChecker), { methods: [] })
  app.use('content-items-test', {
    async find() {
      return {
        data: [{ id: 'item', text: { title: 'Title', content: 'Content' }, [AuthorizationBitmapsKey]: bitmaps }],
        total: 1,
        limit: 1,
        offset: 0,
      }
    },
  })
  const service = app.service('content-items-test')
  service.hooks({ after: { find: contentItemsAfterFindHooks } })
  const { data }: { data: Item[] } = await service.find(params)
  return data[0]
}

describe('content-items find redaction hooks in the web app', () => {
  describe('when called internally as public API (CSV export)', () => {
    const params = { user: researcher, asPublicApi: true }

    it('keeps title and content when public API permission is granted even if web app permission is not', async () => {
      const item = await findInWebApp({ explore: DeniedToResearcher, getTranscript: GrantedToResearcher }, params)
      assert.equal(item.text.title, 'Title')
      assert.equal(item.text.content, 'Content')
    })

    it('redacts title and content when public API permission is not granted even if web app permission is', async () => {
      const item = await findInWebApp({ explore: GrantedToResearcher, getTranscript: DeniedToResearcher }, params)
      assert.equal(item.text.title, '[REDACTED]')
      assert.equal(item.text.content, '[REDACTED]')
    })
  })

  describe('when called as the web app', () => {
    const params = { user: researcher }

    it('redacts content but keeps title when web app permission is not granted', async () => {
      const item = await findInWebApp({ explore: DeniedToResearcher, getTranscript: GrantedToResearcher }, params)
      assert.equal(item.text.title, 'Title')
      assert.equal(item.text.content, '[REDACTED]')
    })

    it('keeps title and content when web app permission is granted, regardless of public API permission', async () => {
      const item = await findInWebApp({ explore: GrantedToResearcher, getTranscript: DeniedToResearcher }, params)
      assert.equal(item.text.title, 'Title')
      assert.equal(item.text.content, 'Content')
    })
  })
})
