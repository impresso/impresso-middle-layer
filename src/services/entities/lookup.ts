import type { ImpressoApplication } from '@/types.js'
import Entity from '@/models/entities.model.js'
import type { EntitySolrDocumentV3 } from '@/models/generated/impressoSchemas/solr/semanticEnrichment.js'
import { SolrNamespaces } from '@/solr.js'
import { buildSearchEntitiesSolrQuery } from './logic.js'

/** Read QID labels and types in bounded batches. The Solr client handles response caching. */
export async function findEntitiesByIds(app: ImpressoApplication, ids: string[]): Promise<Entity[]> {
  const uniqueIds = [...new Set(ids.filter(id => /^Q[0-9]+$/.test(id)))].sort()
  const entities: Entity[] = []
  for (let start = 0; start < uniqueIds.length; start += 500) {
    const batch = uniqueIds.slice(start, start + 500)
    const body = buildSearchEntitiesSolrQuery(
      { filters: [{ type: 'uid', q: batch }], limit: batch.length, offset: 0 },
      app.get('solrConfiguration').namespaces ?? [],
      app.get('features') ?? {}
    )
    body.params = { ...body.params, hl: false }
    const result = await app.service('simpleSolrClient').select<EntitySolrDocumentV3>(SolrNamespaces.Entities, { body })
    entities.push(...(result.response?.docs ?? []).map(Entity.solrFactory()))
  }
  return entities
}

/** Coalesce concurrent facet lookups into one batch instead of querying once per bucket. */
export function createEntityResolver(app: ImpressoApplication) {
  let pending = new Map<string, { resolve: (entity: Entity | undefined) => void; reject: (error: unknown) => void }[]>()
  let scheduled = false
  return (id: string): Promise<Entity | undefined> =>
    new Promise((resolve, reject) => {
      pending.set(id, [...(pending.get(id) ?? []), { resolve, reject }])
      if (scheduled) return
      scheduled = true
      queueMicrotask(async () => {
        const batch = pending
        pending = new Map()
        scheduled = false
        try {
          const entities = new Map((await findEntitiesByIds(app, [...batch.keys()])).map(entity => [entity.id, entity]))
          for (const [id, callbacks] of batch) for (const callback of callbacks) callback.resolve(entities.get(id))
        } catch (error) {
          for (const callbacks of batch.values()) for (const callback of callbacks) callback.reject(error)
        }
      })
    })
}
