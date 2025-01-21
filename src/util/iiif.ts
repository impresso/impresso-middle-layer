import { ProxyConfig } from '../models/generated/common'

const getPrefix = (prefixes: string[], url?: string): string | undefined => {
  return url == null ? undefined : prefixes.find(prefix => url.startsWith(prefix))
}

/**
 * Some images are hosted on internal servers. For them we need
 * to replace the IIIF URLs with the local server proxy URL.
 */
export const sanitizeIiifImageUrl = (url: string, proxyConfig: ProxyConfig): string => {
  const { host, iiif } = proxyConfig
  const proxiedEndpointPrefixes = Object.values(iiif ?? {})
    .map((item: any) => (typeof item === 'object' && 'endpoint' in item ? item.endpoint : undefined))
    .filter(item => item != null)

  const iiifPrefix = getPrefix(proxiedEndpointPrefixes, url)
  if (iiifPrefix != null && host != null) {
    return url.replace(iiifPrefix, `${host}/proxy/iiif/`)
  }
  return url
}
