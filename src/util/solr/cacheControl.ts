import { SelectRequestBody, CachingStrategy } from '../../internalServices/simpleSolr'

const NotCacheableSolrFields = [
  'ucoll_ss', // collections ids
]

export const defaultCachingStrategy: CachingStrategy = (
  url: string,
  requestBody: string,
  responseBody: string
): 'cache' | 'bypass' => {
  const nonCacheableContentPresent = NotCacheableSolrFields.map(field => {
    return url.includes(field) || requestBody.includes(field) || responseBody.includes(field)
  })

  return nonCacheableContentPresent.some(Boolean) ? 'bypass' : 'cache'
}
