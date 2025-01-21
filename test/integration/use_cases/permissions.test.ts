import assert from 'assert'
import app from '../../../src/app'
import { SlimUser } from '../../../src/authentication'
import {
  ContentItemPermissionsDetails,
  getContentItemsPermissionsDetails,
  PermissionDetails,
  PermissionsScope,
} from '../../../src/useCases/getContentItemsPermissionsDetails'
import { UserAccount, getUserAccountsWithAvailablePermissions } from '../../../src/useCases/getUsersPermissionsDetails'
import { bigIntToBitString, bitmapsAlign } from '../../../src/util/bigint'
import { safeStringifyJson } from '../../../src/util/jsonCodec'

import {
  contentItemRedactionPolicy,
  contentItemRedactionPolicyWebApp,
} from '../../../src/services/articles/articles.hooks'
import { trPassageRedactionPolicy } from '../../../src/services/text-reuse-passages/text-reuse-passages.hooks'
import { imageRedactionPolicy } from '../../../src/services/images/images.hooks'
import { DefaultConverters, RedactionPolicy } from '../../../src/util/redaction'
import { JSONPath } from 'jsonpath-plus'
import { SolrNamespaces } from '../../../src/solr'

interface RedactionTestContext {
  scope: PermissionsScope

  contentItemNamespace: keyof typeof SolrNamespaces

  contentItemId: string
  contentItemPermissions: bigint
  contentSample: PermissionDetails['sample']

  userAccountId: number
  userAccountPermissions: bigint

  accessAllowed: boolean
}

const buildSlimUser = (context: RedactionTestContext): SlimUser => ({
  bitmap: context.userAccountPermissions,
  groups: [],
  id: context.userAccountId,
  isStaff: false,
  uid: context.userAccountId.toString(),
})

const buildTestMatrix = (
  contentItemDetails: ContentItemPermissionsDetails,
  imageDetails: ContentItemPermissionsDetails,
  userAccounts: UserAccount[]
): RedactionTestContext[] => {
  const groups: {
    namespace: keyof typeof SolrNamespaces
    permissions: ContentItemPermissionsDetails['permissions']
  }[] = [
    { namespace: 'Search', permissions: contentItemDetails.permissions },
    { namespace: 'Images', permissions: imageDetails.permissions },
  ]
  const items = groups.map(({ namespace, permissions }) => {
    return permissions.map(scopeItem => {
      return scopeItem.permissions.map(permissionItem => {
        return userAccounts.map(userAccount => {
          const contentBitmap = permissionItem.bitmap.valueOf() // as bigint
          const userBitmap = userAccount.bitmap.valueOf() // as bigint

          return {
            scope: scopeItem.scope,

            contentItemNamespace: namespace,
            contentItemId: permissionItem.sample.id,
            contentItemPermissions: contentBitmap,
            contentSample: permissionItem.sample,

            userAccountId: userAccount.sample_user_id,
            userAccountPermissions: userBitmap,

            accessAllowed: bitmapsAlign(contentBitmap, userBitmap),
          } satisfies RedactionTestContext
        })
      })
    })
  })
  return items.flat(4) as RedactionTestContext[]
}

const getPaths = (policy: RedactionPolicy, object: any, redactionExpectation: 'redacted' | 'notRedacted') => {
  const paths: string[] = []

  policy.items.forEach(item => {
    JSONPath({
      path: item.jsonPath,
      json: object,
      resultType: 'value',
      callback: (value, type, payload) => {
        const valueConverter = DefaultConverters[item.valueConverterName]
        const redactedValue = valueConverter(value)
        const actualValue = payload.parent[payload.parentProperty]

        if (redactionExpectation === 'redacted' && actualValue != null && actualValue !== redactedValue) {
          paths.push(item.jsonPath)
        }
        if (redactionExpectation === 'notRedacted' && actualValue === redactedValue) {
          paths.push(item.jsonPath)
        }
      },
    })
  })

  return paths
}

const runner = async (
  testCases: RedactionTestContext[],
  getter: (ctx: RedactionTestContext) => Promise<any>,
  redactionPolicy: RedactionPolicy,
  assertions?: (result: any, ctx: RedactionTestContext) => void,
  inspect?: 'none' | 'redacted' | 'notRedacted'
) => {
  let resultReceivedCounter = 0

  const awaitables = testCases.map(async (testCase, idx) => {
    const result = await getter(testCase)
    resultReceivedCounter++

    process.stdout.write(`Got result ${resultReceivedCounter} of ${testCases.length}...\r`)

    const paths = getPaths(redactionPolicy, result, testCase.accessAllowed ? 'notRedacted' : 'redacted')

    // inspect redaction
    if (inspect != 'none') {
      if (
        (!testCase.accessAllowed && inspect === 'redacted') ||
        (testCase.accessAllowed && inspect === 'notRedacted')
      ) {
        console.log(
          safeStringifyJson(
            {
              testCase,
              result,
            },
            2
          )
        )
      }
    }

    const failMessage = `
        Test case item ${testCase.contentItemId} is supposed to be ${testCase.accessAllowed ? 'not redacted' : 'redacted'} for user ${testCase.userAccountId},
        but these paths are ${testCase.accessAllowed ? 'redacted' : 'not redacted'}: ${paths.join(',')}.
        Content bitmap:\t${bigIntToBitString(testCase.contentItemPermissions)}
        User bitmap:\t${bigIntToBitString(testCase.userAccountPermissions)}
        Content: ${safeStringifyJson(result, 2)}
        `

    assert.strictEqual(paths.length, 0, failMessage)
    assertions?.(result, testCase)
  })

  await Promise.all(awaitables)
}

describe('Bitmap permissions', function () {
  this.timeout(300000)

  let testMatrix: RedactionTestContext[] = []

  before(async () => {
    if (app.get('cache')?.enabled) assert.fail('Cache is enabled. Disable it to run the test without cache.')

    const solrCilent = app.service('simpleSolrClient')
    const sequelize = app.get('sequelizeClient')!

    const [userAccounts, contentPermissionsDetails, imagesPermissionsDetails] = await Promise.all([
      getUserAccountsWithAvailablePermissions(sequelize),
      getContentItemsPermissionsDetails(solrCilent, 'Search'),
      getContentItemsPermissionsDetails(solrCilent, 'Images'),
    ])
    testMatrix = buildTestMatrix(contentPermissionsDetails, imagesPermissionsDetails, userAccounts)
    const totalContentItemPermissions = [
      ...contentPermissionsDetails.permissions,
      ...imagesPermissionsDetails.permissions,
    ].reduce((acc, item) => acc + item.permissions.length, 0)

    console.log(
      `${totalContentItemPermissions} various content item permissions across ${contentPermissionsDetails.permissions.length} scopes found`
    )
    console.log(`${userAccounts.length} various user accounts permissions found`)
    console.log(`${testMatrix.length} test cases in total`)
  })

  describe('Web app', () => {
    if (app.get('isPublicApi')) {
      console.log('Skipping web app tests because this is a public API')
      return
    }

    it('Get article', async () => {
      const getTranscriptCases = testMatrix.filter(
        test => test.scope === 'explore' && test.contentItemNamespace === 'Search'
      )
      const service = app.service('articles')

      await runner(
        getTranscriptCases,
        async testCase => {
          const params = { user: buildSlimUser(testCase), authenticated: true }
          return await service.get(testCase.contentItemId, params)
        },
        contentItemRedactionPolicyWebApp,
        undefined,
        'none'
      )
    })

    it('Search', async () => {
      const getTranscriptCases = testMatrix.filter(
        test => test.scope === 'explore' && test.contentItemNamespace === 'Search'
      )
      const service = app.service('search')

      await runner(
        getTranscriptCases,
        async testCase => {
          const params = {
            user: buildSlimUser(testCase),
            authenticated: true,
            query: {
              sq: '*:*',
              filters: [{ q: [testCase.contentItemId], type: 'uid' }],
            },
          }
          return await service.find(params)
        },
        contentItemRedactionPolicyWebApp,
        (result, testCase) => {
          assert.strictEqual(
            result.data.length,
            1,
            `search for ${testCase.contentItemId} yielded ${result.data.length}. Should be 1`
          )
        },
        'none'
      )
    })

    it('Get image', async () => {
      const getTranscriptCases = testMatrix.filter(
        test => test.scope === 'explore' && test.contentItemNamespace === 'Images'
      )
      const service = app.service('images')

      await runner(
        getTranscriptCases,
        async testCase => {
          const params = { user: buildSlimUser(testCase), authenticated: true }
          return await service.get(testCase.contentItemId, params)
        },
        imageRedactionPolicy,
        undefined,
        'none'
      )
    })

    // TODO when the data is ready
    // it('Web App: text reuse passages', async () => {
    //   // get samples code needs to be updated
    //   // right now it gets samples from the main search index only.
    // })
  })

  describe('Public API', () => {
    if (!app.get('isPublicApi')) {
      console.log('Skipping public API tests because this is not a public API')
      return
    }

    it('Get content item', async () => {
      const getTranscriptCases = testMatrix.filter(
        test => test.scope === 'get_transcript' && test.contentItemNamespace === 'Search'
      )
      const service = app.service('content-items')

      await runner(
        getTranscriptCases,
        async testCase => {
          const params = { user: buildSlimUser(testCase), authenticated: true }
          return await service.get(testCase.contentItemId, params)
        },
        contentItemRedactionPolicy,
        undefined,
        'none'
      )
    })

    it('Search', async () => {
      const getTranscriptCases = testMatrix.filter(
        test => test.scope === 'get_transcript' && test.contentItemNamespace === 'Search'
      )
      const service = app.service('search')

      await runner(
        getTranscriptCases,
        async testCase => {
          const params = {
            user: buildSlimUser(testCase),
            authenticated: true,
            query: {
              sq: '*:*',
              filters: [{ q: [testCase.contentItemId], type: 'uid' }],
            },
          }
          return await service.find(params)
        },
        contentItemRedactionPolicy,
        (result, testCase) => {
          assert.strictEqual(
            result.data.length,
            1,
            `search for ${testCase.contentItemId} yielded ${result.data.length}. Should be 1`
          )
        },
        'none'
      )
    })

    it('Get image', async () => {
      const getTranscriptCases = testMatrix.filter(
        test => test.scope === 'get_transcript' && test.contentItemNamespace === 'Images'
      )
      const service = app.service('images')

      await runner(
        getTranscriptCases,
        async testCase => {
          const params = { user: buildSlimUser(testCase), authenticated: true }
          return await service.get(testCase.contentItemId, params)
        },
        imageRedactionPolicy,
        undefined,
        'none'
      )
    })
  })
})
