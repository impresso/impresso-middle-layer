import type { HookContext } from '@feathersjs/feathers'
import type { ImpressoApplication } from '@/types.js'
import type { PublicFindResponse } from '@/models/common.js'
import type { ContentItem } from '@/models/generated/app/entities/contentItem.js'
import type { FindParams } from '@/services/content-items/content-items.class.js'
import { createReceipt, hashIds, provenanceKeyId } from '@/util/provenance.js'
import { isPublicApi } from './appMode.js'

type DeliveredItem = Pick<ContentItem, 'id'>
type DeliveredResponse = PublicFindResponse<DeliveredItem>

type ProvenanceContext = Pick<HookContext<ImpressoApplication>, 'app' | 'path' | 'http'> & {
  params: FindParams
  service: { isInternalService?: boolean }
  result?: DeliveredResponse
  dispatch?: DeliveredResponse
}

const defaultFindServices = ['content-items', 'search']

function deliveredId(item: DeliveredItem): string {
  if (typeof item !== 'object' || item === null || !('id' in item)) {
    throw new Error('Missing delivered content-item ID')
  }

  return item.id
}

export function provenance(context: ProvenanceContext): void {
  const config = context.app.get('provenance')
  const { user } = context.params

  if (!isPublicApi(context) || !config?.enabled || !user || context.service.isInternalService) {
    return
  }

  const coveredServices = config.findServices ?? defaultFindServices

  if (!coveredServices.includes(context.path)) {
    return
  }

  const result = context.dispatch ?? context.result

  if (typeof result !== 'object' || result === null || !Array.isArray(result.data) || !('pagination' in result)) {
    return
  }

  const digest = hashIds(result.data.map(deliveredId))
  const token = createReceipt(
    {
      kind: 'api',
      path: context.path,
      userRef: user.uid,
      ...digest,
    },
    context.app
  )

  const previousMeta = typeof result.meta === 'object' && result.meta !== null ? result.meta : {}

  result.meta = {
    ...previousMeta,
    provenance: { token, kid: provenanceKeyId(context.app) },
  }

  context.http ??= {}
  context.http.headers = { ...context.http.headers, 'X-Impresso-Provenance': token }
}
