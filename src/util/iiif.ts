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

interface FragmentOptions {
  coordinates: [number, number]
  dimension: 'full' | number
}

export const getExternalFragmentUrl = (
  iiifManifestUrl: string,
  { coordinates, dimension = 'full' }: FragmentOptions
) => {
  const externalUid = iiifManifestUrl.split('/info.json').shift()
  const dim = dimension == 'full' ? dimension : `${dimension},`
  return `${externalUid}/${coordinates.join(',')}/${dim}/0/default.png`
}

export const getJSONUrl = (uid: string, config: ProxyConfig) => {
  const host = config?.host ?? ''
  return `${host}/${uid}/info.json`
}

export const getThumbnailUrl = (
  uid: string,
  config: ProxyConfig,
  { dimension }: Pick<FragmentOptions, 'dimension'> = { dimension: 150 }
) => {
  const host = config?.host ?? ''
  const dim = dimension == 'full' ? dimension : `${dimension},`
  return `${host}/${uid}/full/${dim}/0/default.png`
}

export const getExternalThumbnailUrl = (
  iiifManifestUrl: string,
  { dimension }: Pick<FragmentOptions, 'dimension'> = { dimension: 150 }
) => {
  const externalUid = iiifManifestUrl.split('/info.json').shift()
  const dim = dimension == 'full' ? dimension : `${dimension},`
  return `${externalUid}/full/${dim}/0/default.png`
}
