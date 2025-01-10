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
import { DefaultConverters, RedactionPolicy } from '../../../src/util/redaction'
import { JSONPath } from 'jsonpath-plus'

interface RedactionTestContext {
  scope: PermissionsScope

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
  userAccounts: UserAccount[]
): RedactionTestContext[] => {
  const items = contentItemDetails.permissions.map(scopeItem => {
    return scopeItem.permissions.map(permissionItem => {
      return userAccounts.map(userAccount => {
        const contentBitmap = permissionItem.bitmap.valueOf() // as bigint
        const userBitmap = userAccount.bitmap.valueOf() // as bigint

        return {
          scope: scopeItem.scope,

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
  return items.flat(3) as RedactionTestContext[]
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

describe('Bitmap permissions', function () {
  this.timeout(30000)

  let isPublicApi = false
  let testMatrix: RedactionTestContext[] = []

  before(async () => {
    isPublicApi = app.get('isPublicApi') ?? false

    const solrCilent = app.service('simpleSolrClient')
    const sequelize = app.get('sequelizeClient')!

    const [userAccounts, contentPermissionsDetails] = await Promise.all([
      getUserAccountsWithAvailablePermissions(sequelize),
      getContentItemsPermissionsDetails(solrCilent),
    ])
    testMatrix = buildTestMatrix(contentPermissionsDetails, userAccounts)
    const totalContentItemPermissions = contentPermissionsDetails.permissions.reduce(
      (acc, item) => acc + item.permissions.length,
      0
    )

    console.log(
      `${totalContentItemPermissions} various content item permissions across ${contentPermissionsDetails.permissions.length} scopes found`
    )
    console.log(`${userAccounts.length} various user accounts permissions found`)
    console.log(`${testMatrix.length} test cases to run`)
  })

  it('Web App: get article', async () => {
    if (isPublicApi) return

    const redactionPolicy = contentItemRedactionPolicyWebApp
    const getTranscriptCases = testMatrix.filter(test => test.scope === 'explore')
    const service = app.service('articles')

    const indices = Array.from({ length: getTranscriptCases.length }, (_, i) => i)

    for await (const idx of indices) {
      const testCase = getTranscriptCases[idx]
      console.log(`Testing case ${idx} of ${getTranscriptCases.length}...`)
      const params = { user: buildSlimUser(testCase) }
      const result = await service.get(testCase.contentItemId, params)

      const paths = getPaths(redactionPolicy, result, testCase.accessAllowed ? 'notRedacted' : 'redacted')

      const failMessage = `
        Content item ${testCase.contentItemId} is supposed to be ${testCase.accessAllowed ? 'not redacted' : 'redacted'} for user ${testCase.userAccountId},
        but these paths are ${testCase.accessAllowed ? 'redacted' : 'not redacted'}: ${paths.join(',')}.
        Content bitmap:\t${bigIntToBitString(testCase.contentItemPermissions)}
        User bitmap:\t${bigIntToBitString(testCase.userAccountPermissions)}
        Content: ${safeStringifyJson(result, 2)}
        `

      assert.strictEqual(paths.length, 0, failMessage)
    }
  })
})
