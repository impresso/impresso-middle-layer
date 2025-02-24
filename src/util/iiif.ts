import { ImageUrlRewriteRule } from '../models/generated/common'

/**
 * Some images are hosted on internal servers. For them we need
 * to replace the IIIF URLs with the local server proxy URL.
 */
export const sanitizeIiifImageUrl = (url: string, rules: ImageUrlRewriteRule[]): string => {
  const rule = rules.find(rule => url.match(new RegExp(rule.pattern)))

  if (rule == null) return url
  return url.replace(new RegExp(rule.pattern), rule.replacement)
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

export const getJSONUrl = (uid: string, baseUrl: string) => {
  return `${baseUrl}/${uid}/info.json`
}

export const getManifestJSONUrl = (url: string) => {
  if (url.endsWith('/info.json')) {
    return url
  }
  return `${url}/info.json`
}

export const getThumbnailUrl = (
  uid: string,
  baseUrl: string,
  { dimension = 150 }: Pick<FragmentOptions, 'dimension'> = { dimension: 150 }
) => {
  const dim = dimension == 'full' ? dimension : `${dimension},`
  return `${baseUrl}/${uid}/full/${dim}/0/default.png`
}

export const getExternalThumbnailUrl = (
  iiifManifestUrl: string,
  { dimension = 150 }: Pick<FragmentOptions, 'dimension'> = { dimension: 150 }
) => {
  const externalUid = iiifManifestUrl.split('/info.json').shift()
  const dim = dimension == 'full' ? dimension : `${dimension},`
  return `${externalUid}/full/${dim}/0/default.png`
}
