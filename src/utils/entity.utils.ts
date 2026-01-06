/**
 * Entity-related utility functions
 */

import { EntityDetails } from '@/models/generated/schemas.js'

export const EntityCodes = {
  50: 'person',
  53: 'organisation',
  54: 'location',
  55: 'newsagency',
} satisfies Record<number, EntityDetails['type']>

export const TypeCodeToType = Object.entries(EntityCodes).reduce(
  (acc, [key, value]) => {
    acc[key] = value
    return acc
  },
  {} as Record<string, EntityDetails['type']>
)

export const TypeShorthandToType: Record<string, string> = {
  pers: 'person',
  loc: 'location',
  nag: 'newsagency',
  org: 'organisation',
}

export const TypeToTypeShorthand: Record<string, string> = Object.entries(TypeShorthandToType).reduce(
  (acc, [key, value]) => {
    acc[value] = key
    return acc
  },
  {} as Record<string, string>
)

/**
 * Extracts the display name from an entity UID
 */
export function getNameFromUid(uid: string): string {
  if (uid.indexOf('bert-') === 0) {
    return uid
      .replace(/^bert-[a-z]+-\d+-/, '')
      .split('_')
      .join(' ')
  }

  // Handle formats like "2-50-Kanton_Waadt"
  if (/^\d+-\d+-/.test(uid)) {
    return uid
      .replace(/^\d+-\d+-/, '')
      .replace(/\$([^$]+)\$/g, (m, n: string) => String.fromCharCode(parseInt(n, 16)))
      .split('_')
      .join(' ')
  }

  // Handle aida formats (both aida-10-50 and aida-0001-50)
  return uid
    .replace(/^aida-\d+-\d+-/, '')
    .replace(/\$([^$]+)\$/g, (m, n: string) => String.fromCharCode(parseInt(n, 16)))
    .split('_')
    .join(' ')
}

/**
 * Extracts the entity type from an entity UID
 */
export function getTypeCodeFromUid(uid: string): string {
  // Handle formats like "2-50-Kanton_Waadt"
  if (/^\d+-\d+-/.test(uid)) {
    return uid.replace(/^\d+-(\d+)-.*/, '$1')
  }

  // Handle aida formats (both aida-10-50 and aida-0001-50)
  return uid.replace(/^aida-\d+-(\d+)-.*/, '$1')
}

export const getTypeFromUid = (uid: string): string | undefined => {
  return TypeCodeToType[getTypeCodeFromUid(uid)]
}
