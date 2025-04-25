import { ImageUrlRewriteRule } from '../models/generated/common'

import {
  regionParameterToString,
  sizeParameterToString,
  rotationParameterToString,
  parseImageServiceRequest,
  SizeParameter,
} from '@iiif/parser/image-3'

/**
 * Some images are hosted on internal servers. For them we need
 * to replace the IIIF URLs with the local server proxy URL.
 */
export const sanitizeIiifImageUrl = (url: string, rules: ImageUrlRewriteRule[]): string => {
  const rule = rules.find(rule => url.match(new RegExp(rule.pattern)))

  if (rule == null) return url
  return url.replace(new RegExp(rule.pattern), rule.replacement)
}

const formatSizeParameter = (size: SizeParameter): string => {
  let sizeParam = sizeParameterToString(size)
  if (sizeParam.includes('pct:') && sizeParam.endsWith(',')) {
    sizeParam = sizeParam.substring(0, sizeParam.length - 1)
  }
  return sizeParam
}

const dimensionToFormattedSizeParameter = (dimension: 'full' | 'max' | number): string => {
  if (dimension === 'full' || dimension === 'max') {
    return 'max'
  } else if (typeof dimension === 'number') {
    return `${dimension},`
  }
  throw new Error(`Invalid dimension: ${dimension}`)
}

interface FragmentOptions {
  coordinates: [number, number]
  dimension: 'full' | 'max' | number
}

export const getExternalFragmentUrl = (
  iiifManifestUrl: string,
  { coordinates, dimension = 'full' }: FragmentOptions
) => {
  const externalUid = iiifManifestUrl.split('/info.json').shift()
  const size = dimensionToFormattedSizeParameter(dimension)
  return `${externalUid}/${coordinates.join(',')}/${size}/0/default.png`
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
  const size = dimensionToFormattedSizeParameter(dimension)
  return `${baseUrl}/${uid}/max/${size}/0/default.png`
}

export const getExternalThumbnailUrl = (
  iiifManifestUrl: string,
  { dimension = 150 }: Pick<FragmentOptions, 'dimension'> = { dimension: 150 }
) => {
  const externalUid = iiifManifestUrl.split('/info.json').shift()
  const size = dimensionToFormattedSizeParameter(dimension)
  return `${externalUid}/max/${size}/0/default.png`
}

/**
 * Given a IIIF URL compatible with v1 and v2, return a v3 compatible URL.
 * Implemented using `@iiif/parser`
 */
export const getV3CompatibleIIIFUrl = (url: string) => {
  const req = parseImageServiceRequest(url)
  if (req == null) return undefined

  // Based on
  // https://github.com/IIIF-Commons/parser/blob/1e528d5922c5b6ac8c203fc223a49ce77d7a2366/src/image-3/serialize/image-service-request-to-string.ts

  const prefix = req.prefix.startsWith('/') ? req.prefix.substring(1) : req.prefix
  const baseUrl = `${req.scheme}://${req.server}/${prefix ? `${prefix}/` : ''}${req.identifier}`

  if (req.type === 'base') {
    return baseUrl
  }

  if (req.type === 'info') {
    return `${baseUrl}/info.json`
  }

  const { region, rotation, format, quality, size: sizeOrig } = req
  let size = { ...sizeOrig, version: 3 as 3 }

  if (size.max && size.serialiseAsFull) {
    size = { ...size, serialiseAsFull: false }
  }

  return [
    baseUrl,
    regionParameterToString(region),
    formatSizeParameter(size),
    rotationParameterToString(rotation),
    `${quality}.${format}`,
  ]
    .filter(Boolean)
    .join('/')
}

export const getV3CompatibleIIIFUrlWithoutDomain = (url: string) => {
  if (url.startsWith('http')) return getV3CompatibleIIIFUrl(url)

  const placeholderBaseUrl = 'http://example.com'
  const updatedUrl = getV3CompatibleIIIFUrl(`${placeholderBaseUrl}/${url}`)
  return updatedUrl?.replace(placeholderBaseUrl, '')
}
